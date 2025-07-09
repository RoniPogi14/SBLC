import pymysql
pymysql.install_as_MySQLdb()

from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, send_file
from flask_mysqldb import MySQL
import MySQLdb.cursors
import os
import base64
from werkzeug.utils import secure_filename
from datetime import datetime


app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Change this to a secure key

# MySQL Configuration
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_DB'] = 'digitaldocument'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

# File Upload Configuration
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

mysql = MySQL(app)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# HIERARCHY CONFIGURATION
# Higher numbers = higher authority (HR is highest)
DEPARTMENT_HIERARCHY = {
    'HR': 4,        # Highest level
    'DEAN': 3,      # Second level  
    'Accounting': 2, # Third level
    'IT': 1,        # Lowest level
    'ADMIN': 1      # Same level as IT
}

# Get hierarchy order for approval flow
APPROVAL_ORDER = ['HR', 'DEAN', 'Accounting', 'IT', 'ADMIN']

def get_next_approval_level(request_id):
    """Get the next department that should approve based on strict hierarchy"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get the assigned departments for this request
        cursor.execute("SELECT assigned_to FROM requests WHERE id = %s", (request_id,))
        request_info = cursor.fetchone()
        if not request_info:
            return None
        
        assigned_departments = []
        if request_info['assigned_to']:
            raw_departments = request_info['assigned_to'].split(',')
            assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
        
        # If "All Departments" is assigned, use the full hierarchy
        if 'All Departments' in assigned_departments:
            assigned_departments = APPROVAL_ORDER.copy()
        
        # Ensure Admin is always the final approver
        if 'ADMIN' not in assigned_departments:
            assigned_departments.append('ADMIN')
        
        # Get departments that have already approved in hierarchy order
        cursor.execute("""
            SELECT department FROM approvals 
            WHERE request_id = %s AND signed = 1
            ORDER BY FIELD(department, 'HR', 'DEAN', 'Accounting', 'IT', 'ADMIN')
        """, (request_id,))
        approved_depts = [row['department'] for row in cursor.fetchall()]
        
        # Find the next department in hierarchy order that hasn't approved yet
        for dept in APPROVAL_ORDER:
            if dept in assigned_departments and dept not in approved_depts:
                return dept
        
        return None  # All assigned departments have approved
        
    except Exception as e:
        print(f"Error in get_next_approval_level: {e}")
        return None
    finally:
        cursor.close()
        
def can_approve_request_hierarchy(request_id, user_department, user_role=None):
    """STRICT HIERARCHY: Check if user can approve based on hierarchy order"""
    if not user_department and user_role != 'admin':
        return False, "User department not found"
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get request info
        cursor.execute("SELECT assigned_to, status FROM requests WHERE id = %s", (request_id,))
        request_info = cursor.fetchone()
        if not request_info:
            return False, "Request not found"
        
        # Must be pending or approved status
        if request_info['status'].lower() not in ['pending', 'approved']:
            return False, f"Request status is '{request_info['status']}'"
        
        # Get assigned departments
        assigned_departments = []
        if request_info['assigned_to']:
            raw_departments = request_info['assigned_to'].split(',')
            assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
        
        # Handle "All Departments"
        if 'All Departments' in assigned_departments:
            assigned_departments = APPROVAL_ORDER.copy()
        
        # Ensure Admin is always the final approver
        if 'ADMIN' not in assigned_departments:
            assigned_departments.append('ADMIN')
        
        # ADMIN SPECIAL PRIVILEGES: Admin can only approve if all other departments have approved
        if user_role == 'admin' or user_department == 'ADMIN':
            # Check if admin already approved
            cursor.execute("""
                SELECT signed FROM approvals 
                WHERE request_id = %s AND department = 'ADMIN'
            """, (request_id,))
            approval = cursor.fetchone()
            
            if approval and approval['signed'] == 1:
                return False, "Admin already approved"
            
            # Check if all other assigned departments have approved
            other_departments = [dept for dept in assigned_departments if dept != 'ADMIN']
            if other_departments:
                cursor.execute("""
                    SELECT COUNT(*) as approved_count FROM approvals 
                    WHERE request_id = %s AND department IN ({}) AND signed = 1
                """.format(','.join(['%s'] * len(other_departments))), 
                [request_id] + other_departments)
                
                approved_count = cursor.fetchone()['approved_count']
                required_count = len(other_departments)
                
                if approved_count < required_count:
                    return False, f"Admin can only approve after all departments have signed ({approved_count}/{required_count} completed)"
            
            return True, "Ready for final admin approval"
        
        # Regular department approval logic with strict hierarchy
        if user_department not in assigned_departments:
            return False, f"Not assigned to {user_department}"
        
        # Check if this department already approved
        cursor.execute("""
            SELECT signed FROM approvals 
            WHERE request_id = %s AND department = %s
        """, (request_id, user_department))
        approval = cursor.fetchone()
        
        if approval and approval['signed'] == 1:
            return False, f"{user_department} already approved"
        
        # HIERARCHY CHECK: Ensure all higher-level departments have approved first
        user_dept_index = APPROVAL_ORDER.index(user_department) if user_department in APPROVAL_ORDER else -1
        if user_dept_index == -1:
            return False, f"Department {user_department} not found in approval hierarchy"
        
        # Check if all previous departments in hierarchy have approved
        for i in range(user_dept_index):
            prev_dept = APPROVAL_ORDER[i]
            if prev_dept in assigned_departments:
                cursor.execute("""
                    SELECT signed FROM approvals 
                    WHERE request_id = %s AND department = %s
                """, (request_id, prev_dept))
                prev_approval = cursor.fetchone()
                
                if not prev_approval or prev_approval['signed'] != 1:
                    return False, f"Cannot approve: {prev_dept} must approve first (hierarchy order: {' → '.join(APPROVAL_ORDER)})"
        
        # Check if this is actually the next department that should approve
        next_approver = get_next_approval_level(request_id)
        if next_approver != user_department:
            if next_approver:
                return False, f"Not your turn yet. Next approver should be: {next_approver}"
            else:
                return False, "All approvals completed"
        
        return True, f"Ready for {user_department} approval"
        
    except Exception as e:
        print(f"Error checking hierarchy approval: {e}")
        return False, str(e)
    finally:
        cursor.close()

def can_approve_request_simple(request_id, user_department, user_role=None):
    """ENHANCED: Check if user can approve with special admin handling"""
    if not user_department and user_role != 'admin':
        return False, "User department not found"
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get request info
        cursor.execute("SELECT assigned_to, status FROM requests WHERE id = %s", (request_id,))
        request_info = cursor.fetchone()
        if not request_info:
            return False, "Request not found"
        
        # Must be pending or approved status
        if request_info['status'].lower() not in ['pending', 'approved']:
            return False, f"Request status is '{request_info['status']}'"
        
        # ADMIN SPECIAL PRIVILEGES: Admin can approve any request
        if user_role == 'admin':
            # Check if admin already approved
            cursor.execute("""
                SELECT signed FROM approvals 
                WHERE request_id = %s AND department = 'ADMIN'
            """, (request_id,))
            approval = cursor.fetchone()
            
            if approval and approval['signed'] == 1:
                return False, "Admin already approved"
            
            return True, "Admin can approve any request"
        
        # Regular approver logic
        assigned_departments = []
        if request_info['assigned_to']:
            raw_departments = request_info['assigned_to'].split(',')
            assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
        
        # Handle "All Departments"
        if 'All Departments' in assigned_departments:
            assigned_departments = APPROVAL_ORDER.copy()
        
        # Check if this department is assigned
        if user_department not in assigned_departments:
            return False, f"Not assigned to {user_department}"
        
        # Check if already approved by this department
        cursor.execute("""
            SELECT signed FROM approvals 
            WHERE request_id = %s AND department = %s
        """, (request_id, user_department))
        approval = cursor.fetchone()
        
        if approval and approval['signed'] == 1:
            return False, f"{user_department} already approved"
        
        return True, f"Can approve"
        
    except Exception as e:
        print(f"Error checking approval: {e}")
        return False, str(e)
    finally:
        cursor.close()

def get_approval_status_summary_hierarchy(request_id):
    """Get approval status summary with strict hierarchy visualization"""
    cursor = mysql.connection.cursor()
    
    # Get the assigned departments for this request
    cursor.execute("SELECT assigned_to FROM requests WHERE id = %s", (request_id,))
    request_info = cursor.fetchone()
    if not request_info:
        cursor.close()
        return {}
    
    assigned_departments = []
    if request_info['assigned_to']:
        raw_departments = request_info['assigned_to'].split(',')
        assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
    
    # If "All Departments" is assigned, use the full hierarchy
    if 'All Departments' in assigned_departments:
        assigned_departments = APPROVAL_ORDER.copy()
    
    # Ensure Admin is always the final approver
    if 'ADMIN' not in assigned_departments:
        assigned_departments.append('ADMIN')
    
    cursor.execute("""
        SELECT department, signed, signed_by, signed_at 
        FROM approvals 
        WHERE request_id = %s
        ORDER BY FIELD(department, 'HR', 'DEAN', 'Accounting', 'IT', 'ADMIN')
    """, (request_id,))
    approvals = cursor.fetchall()
    cursor.close()
    
    # Create status for each assigned department in strict hierarchy order
    status = {}
    approved_depts = {app['department']: app for app in approvals if app['signed']}
    next_dept = get_next_approval_level(request_id)
    
    for i, dept in enumerate(APPROVAL_ORDER):
        if dept in assigned_departments:
            if dept in approved_depts:
                status[dept] = {
                    'status': 'approved',
                    'signed_at': approved_depts[dept]['signed_at'],
                    'signed_by': approved_depts[dept]['signed_by'],
                    'order': i + 1
                }
            elif dept == next_dept:
                status[dept] = {
                    'status': 'current',
                    'order': i + 1
                }
            else:
                # Check if this department is blocked by previous departments
                blocked = False
                for j in range(i):
                    prev_dept = APPROVAL_ORDER[j]
                    if prev_dept in assigned_departments and prev_dept not in approved_depts:
                        blocked = True
                        break
                
                status[dept] = {
                    'status': 'blocked' if blocked else 'waiting',
                    'order': i + 1
                }
    
    return status

# --- Authentication Middleware ---
def login_required(f):
    """Decorator to ensure user is logged in"""
    from functools import wraps
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*roles):
    """Decorator to ensure user has required role"""
    def decorator(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_role' not in session or session['user_role'] not in roles:
                flash('You do not have permission to access this page', 'error')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Routes ---
@app.route('/')
def index():
    cursor = mysql.connection.cursor()
    cursor.execute("""
        SELECT r.id, r.title, r.description, r.status, r.created_by, r.created_at
        FROM requests r 
        ORDER BY r.created_at DESC 
        LIMIT 2
    """)
    recent_requests = cursor.fetchall()
    cursor.close()
    
    return render_template('dashboard.html', recent_requests=recent_requests)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        cursor = mysql.connection.cursor()
        cursor.execute("""
            SELECT * FROM users 
            WHERE username = %s AND password = %s 
            AND (archived = FALSE OR archived IS NULL)
        """, (username, password))
        user = cursor.fetchone()
        cursor.close()
        
        if user:
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_role'] = user['role']
            session['user_department'] = user['department']
            return redirect(url_for('dashboard'))
        else:
            # Check if user exists but is archived
            cursor = mysql.connection.cursor()
            cursor.execute("""
                SELECT archived FROM users 
                WHERE username = %s AND password = %s
            """, (username, password))
            archived_user = cursor.fetchone()
            cursor.close()
            
            if archived_user and archived_user['archived']:
                flash('Your account has been archived. Please contact the administrator.', 'error')
            else:
                flash('Invalid username or password', 'error')
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/get-started')
def get_started():
    return render_template('get_started.html')

@app.route('/dashboard')
@login_required
def dashboard():
    user_role = session.get('user_role')
    user_id = session.get('user_id')
    user_department = session.get('user_department')
    
    cursor = mysql.connection.cursor()
    
    try:
        if user_role == 'requestor':
            # Requestor logic remains the same
            cursor.execute("""
                SELECT r.id, r.title, r.description, r.status, r.assigned_to, 
                       r.created_at, r.deadline, r.urgent, COUNT(d.id) as document_count 
                FROM requests r 
                LEFT JOIN documents d ON r.id = d.request_id 
                WHERE r.created_by = %s 
                GROUP BY r.id 
                ORDER BY r.created_at DESC 
                LIMIT 5
            """, (user_id,))
            dict_requests = cursor.fetchall()
            
            requests = []
            for req in dict_requests:
                requests.append((
                    req['id'], req['title'], req['description'], req['status'],
                    req['assigned_to'], req['created_at'], req['deadline'],
                    req['urgent'], req['document_count']
                ))
            
            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
                FROM requests 
                WHERE created_by = %s
            """, (user_id,))
            counts_dict = cursor.fetchone()
            counts = (counts_dict['draft_count'] or 0, counts_dict['pending_count'] or 0, counts_dict['approved_count'] or 0)
            pending_count = None
            
        elif user_role == 'approver':
            # UPDATED: Use hierarchy logic for approvers
            cursor.execute("""
                SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                       r.created_at, r.deadline, r.urgent, u.name as requester_name 
                FROM requests r 
                JOIN users u ON r.created_by = u.id 
                WHERE r.status IN ('pending', 'approved')
                ORDER BY r.created_at DESC 
                LIMIT 20
            """)
            all_requests = cursor.fetchall()
            
            # Filter requests using hierarchy logic
            approval_requests = []
            pending_count_calc = 0
            
            for req in all_requests:
                # Use hierarchy-based approval check
                can_approve, reason = can_approve_request_hierarchy(req['id'], user_department, 'approver')
                
                if can_approve:
                    approval_requests.append((
                        req['id'], req['title'], req['description'], req['status'],
                        req['assigned_to'], req['created_at'], req['deadline'],
                        req['urgent'], req['requester_name']
                    ))
                    pending_count_calc += 1
            
            # Get approver's own requests
            cursor.execute("""
                SELECT r.id, r.title, r.description, r.status, r.assigned_to, 
                       r.created_at, r.deadline, r.urgent, COUNT(d.id) as document_count 
                FROM requests r 
                LEFT JOIN documents d ON r.id = d.request_id 
                WHERE r.created_by = %s 
                GROUP BY r.id 
                ORDER BY r.created_at DESC 
                LIMIT 3
            """, (user_id,))
            own_requests_dict = cursor.fetchall()
            
            own_requests = []
            for req in own_requests_dict:
                own_requests.append((
                    req['id'], req['title'], req['description'], req['status'],
                    req['assigned_to'], req['created_at'], req['deadline'],
                    req['urgent'], req['document_count']
                ))
            
            # Combine requests for display
            requests = approval_requests[:3] + own_requests[:2]
            pending_count = pending_count_calc
            
            # Get counts for approver's own requests
            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
                FROM requests 
                WHERE created_by = %s
            """, (user_id,))
            counts_dict = cursor.fetchone()
            counts = (counts_dict['draft_count'] or 0, counts_dict['pending_count'] or 0, counts_dict['approved_count'] or 0)
            
        elif user_role == 'admin':
            # Admin logic - enhanced to show hierarchy information
            cursor.execute("""
                SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                       r.created_at, r.deadline, r.urgent, u.name as requester_name 
                FROM requests r 
                JOIN users u ON r.created_by = u.id 
                ORDER BY r.created_at DESC 
                LIMIT 10
            """)
            dict_requests = cursor.fetchall()
            
            # Filter to show admin's actionable requests first
            admin_actionable = []
            other_requests = []
            
            for req in dict_requests:
                # Check if admin can approve this request
                can_approve, reason = can_approve_request_hierarchy(req['id'], 'ADMIN', 'admin')
                
                req_tuple = (
                    req['id'], req['title'], req['description'], req['status'],
                    req['assigned_to'], req['created_at'], req['deadline'],
                    req['urgent'], req['requester_name']
                )
                
                if can_approve:
                    admin_actionable.append(req_tuple)
                else:
                    other_requests.append(req_tuple)
            
            # Show actionable requests first, then others
            requests = admin_actionable + other_requests[:5-len(admin_actionable)]
            
            # Get counts
            cursor.execute("""
                SELECT 
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                    COUNT(*) as total_count
                FROM requests
            """)
            counts_dict = cursor.fetchone()
            counts = (counts_dict['pending_count'] or 0, counts_dict['approved_count'] or 0, counts_dict['total_count'] or 0)
            pending_count = len(admin_actionable)  # Number of requests admin can approve
        
    except Exception as e:
        print(f"Error in dashboard: {e}")
        flash(f'Error loading dashboard: {str(e)}', 'error')
        requests = []
        counts = (0, 0, 0)
        pending_count = 0
    finally:
        cursor.close()
    
    return render_template('dashboard.html', 
                         requests=requests, 
                         counts=counts,
                         pending_count=pending_count)

@app.route('/debug/all-data')
@login_required
def debug_all_data():
    """Comprehensive debug route"""
    cursor = mysql.connection.cursor()
    
    debug_info = []
    debug_info.append("<h1>🔍 Complete System Debug</h1>")
    debug_info.append(f"<p><strong>Current User:</strong> {session.get('user_name')} ({session.get('user_role')}) - Department: {session.get('user_department')}</p>")
    debug_info.append("<hr>")
    
    # Show all users and their departments
    cursor.execute("SELECT id, username, name, role, department FROM users ORDER BY role, department")
    users = cursor.fetchall()
    
    debug_info.append("<h2>👥 All Users</h2>")
    debug_info.append("<table border='1' style='border-collapse: collapse;'>")
    debug_info.append("<tr style='background: #f0f0f0;'><th>ID</th><th>Username</th><th>Name</th><th>Role</th><th>Department</th></tr>")
    for user in users:
        debug_info.append(f"<tr><td>{user['id']}</td><td>{user['username']}</td><td>{user['name']}</td><td>{user['role']}</td><td>{user['department'] or 'None'}</td></tr>")
    debug_info.append("</table><hr>")
    
    # Show all requests
    cursor.execute("""
        SELECT r.id, r.title, r.status, r.assigned_to, u.name as requester
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        ORDER BY r.created_at DESC
    """)
    requests = cursor.fetchall()
    
    debug_info.append("<h2>📋 All Requests</h2>")
    debug_info.append("<table border='1' style='border-collapse: collapse;'>")
    debug_info.append("<tr style='background: #f0f0f0;'><th>ID</th><th>Title</th><th>Status</th><th>Assigned To</th><th>Requester</th></tr>")
    for req in requests:
        status_color = ""
        if req['status'] == 'draft':
            status_color = "style='background: #fff3cd;'"
        elif req['status'] == 'pending':
            status_color = "style='background: #d1ecf1;'"
            
        debug_info.append(f"<tr {status_color}><td>{req['id']}</td><td>{req['title']}</td><td><strong>{req['status']}</strong></td><td>{req['assigned_to']}</td><td>{req['requester']}</td></tr>")
    debug_info.append("</table><hr>")
    
    # Show approval records
    cursor.execute("""
        SELECT a.request_id, a.department, a.signed, r.title 
        FROM approvals a 
        JOIN requests r ON a.request_id = r.id 
        ORDER BY a.request_id, a.department
    """)
    approvals = cursor.fetchall()
    
    debug_info.append("<h2>✅ Approval Records</h2>")
    debug_info.append("<table border='1' style='border-collapse: collapse;'>")
    debug_info.append("<tr style='background: #f0f0f0;'><th>Request ID</th><th>Title</th><th>Department</th><th>Signed</th></tr>")
    for approval in approvals:
        signed_status = "✅ Yes" if approval['signed'] else "⏳ No"
        debug_info.append(f"<tr><td>{approval['request_id']}</td><td>{approval['title']}</td><td>{approval['department']}</td><td>{signed_status}</td></tr>")
    debug_info.append("</table><hr>")
    
    cursor.close()
    
    return "<br>".join(debug_info)

@app.route('/my-requests')
@login_required
@role_required('requestor', 'approver')
def my_requests():
    user_id = session.get('user_id')
    
    cursor = mysql.connection.cursor()
    cursor.execute("""
        SELECT r.id, r.title, r.description, r.status, r.assigned_to,
               r.created_at, r.deadline, r.urgent, COUNT(d.id) as document_count 
        FROM requests r 
        LEFT JOIN documents d ON r.id = d.request_id 
        WHERE r.created_by = %s 
        GROUP BY r.id 
        ORDER BY r.created_at DESC
    """, (user_id,))
    dict_requests = cursor.fetchall()
    cursor.close()
    
    # Convert to tuples for template
    requests = []
    for req in dict_requests:
        requests.append((
            req['id'], req['title'], req['description'], req['status'],
            req['assigned_to'], req['created_at'], req['deadline'],
            req['urgent'], req['document_count']
        ))
    
    return render_template('requests.html', 
                         requests=requests, 
                         page_type='my_requests')

@app.route('/pending-approvals')
@login_required
@role_required('approver')
def pending_approvals():
    user_department = session.get('user_department')
    
    if not user_department:
        flash('User department not found. Please contact administrator.', 'error')
        return redirect(url_for('dashboard'))
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get all pending/approved requests
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            WHERE r.status IN ('pending', 'approved')
            ORDER BY r.urgent DESC, r.created_at DESC
        """)
        all_requests = cursor.fetchall()
        
        # Filter requests using hierarchy logic
        requests = []
        print(f"\nDEBUG - Checking hierarchy approvals for department: {user_department}")
        
        for req in all_requests:
            # Use hierarchy-based approval check
            can_approve, reason = can_approve_request_hierarchy(req['id'], user_department, 'approver')
            
            print(f"Request {req['id']} - Can {user_department} approve: {can_approve} ({reason})")
            
            if can_approve:
                requests.append((
                    req['id'], req['title'], req['description'], req['status'],
                    req['assigned_to'], req['created_at'], req['deadline'],
                    req['urgent'], req['requester_name']
                ))
                print(f"Added request {req['id']} to pending list for {user_department}")
        
        print(f"DEBUG - Found {len(requests)} requests for {user_department} to approve (hierarchy-based)")
        
    except Exception as e:
        print(f"Error in pending_approvals: {e}")
        flash(f'Error loading pending approvals: {str(e)}', 'error')
        requests = []
    finally:
        cursor.close()
    
    return render_template('requests.html', 
                         requests=requests, 
                         page_type='pending_approvals')
        
@app.route('/all-requests')
@login_required
@role_required('admin', 'approver')
def all_requests():
    cursor = mysql.connection.cursor()
    
    if session.get('user_role') == 'admin':
        # Admins see all requests
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            ORDER BY r.created_at DESC
        """)
    else:
        # Approvers see all requests (for visibility)
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            ORDER BY r.created_at DESC
        """)
    
    dict_requests = cursor.fetchall()
    cursor.close()
    
    # Convert to tuples for template
    requests = []
    for req in dict_requests:
        requests.append((
            req['id'], req['title'], req['description'], req['status'],
            req['assigned_to'], req['created_at'], req['deadline'],
            req['urgent'], req['requester_name']
        ))
    
    return render_template('requests.html', 
                         requests=requests, 
                         page_type='all_requests')

@app.route('/requests/new', methods=['GET', 'POST'])
@login_required
@role_required('requestor', 'approver')
def new_request():
    if request.method == 'POST':
        title = request.form['title']
        description = request.form['description']
        deadline = request.form.get('deadline')
        urgent = 1 if 'urgent' in request.form else 0
        status = request.form.get('status', 'draft')
        
        # Handle multiple department assignments
        assigned_departments = request.form.getlist('assigned_to')
        if not assigned_departments:
            flash('Please select at least one department', 'error')
            return redirect(url_for('new_request'))
        
        # Clean department names and convert to comma-separated string
        cleaned_departments = [dept.strip() for dept in assigned_departments if dept.strip()]
        assigned_to = ','.join(cleaned_departments)
        
        cursor = mysql.connection.cursor()
        
        # Insert request
        cursor.execute("""
            INSERT INTO requests (title, description, status, created_by, 
                                deadline, urgent, assigned_to, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (title, description, status, session['user_id'], deadline, urgent, assigned_to))
        
        request_id = cursor.lastrowid
        
        # Initialize approval records for hierarchy if request is submitted
        if status == 'pending':
            print(f"Creating approval records for request {request_id}")
            print(f"Assigned departments: {cleaned_departments}")
            
            # Create approval records for each assigned department
            for dept in cleaned_departments:
                if dept != 'All Departments':  # Don't create record for "All Departments"
                    print(f"Creating approval record for department: {dept}")
                    cursor.execute("""
                        INSERT INTO approvals (request_id, department, signed, signed_by, 
                                             signed_at, comments, signature)
                        VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                    """, (request_id, dept))
                else:
                    # If "All Departments" is selected, create records for all departments in hierarchy
                    print("Creating approval records for all departments")
                    for dept_name in APPROVAL_ORDER:
                        cursor.execute("""
                            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                                 signed_at, comments, signature)
                            VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                        """, (request_id, dept_name))
        
        # Handle file upload
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
                    # Add timestamp to filename to avoid conflicts
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"{timestamp}_{filename}"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(filepath)
                    
                    # Save file info to database
                    cursor.execute("""
                        INSERT INTO documents (request_id, name, file_path, 
                                             uploaded_at, is_initial)
                        VALUES (%s, %s, %s, NOW(), 1)
                    """, (request_id, filename, filepath))
        
        mysql.connection.commit()
        cursor.close()
        
        flash('Request created successfully', 'success')
        return redirect(url_for('view_request', request_id=request_id))
    
    # Get departments for checklist
    cursor = mysql.connection.cursor()
    cursor.execute("""
        SELECT DISTINCT department 
        FROM users 
        WHERE role = 'approver' 
        AND department IS NOT NULL 
        AND (archived = FALSE OR archived IS NULL)
        ORDER BY department
    """)
    departments = [row['department'] for row in cursor.fetchall()]
    cursor.close()
    
    return render_template('new_request.html', departments=departments)

@app.route('/debug/approvals')
@login_required
def debug_approvals():
    """Debug route to test approval logic - remove in production"""
    user_department = session.get('user_department')
    user_role = session.get('user_role')
    
    if user_role != 'approver':
        return f"You need to be logged in as an approver. Current role: {user_role}"
    
    cursor = mysql.connection.cursor()
    
    # Get all pending/approved requests
    cursor.execute("""
        SELECT r.id, r.title, r.assigned_to, r.status
        FROM requests r 
        WHERE r.status IN ('pending', 'approved')
        ORDER BY r.created_at DESC
    """)
    requests = cursor.fetchall()
    
    debug_info = []
    debug_info.append(f"<h2>Debug Approval Logic for User: {session.get('user_name')} ({user_department})</h2>")
    debug_info.append(f"<p><strong>User Department:</strong> {user_department}</p>")
    debug_info.append(f"<p><strong>Approval Order:</strong> {APPROVAL_ORDER}</p>")
    debug_info.append("<hr>")
    
    for req in requests:
        debug_info.append(f"<h3>Request #{req['id']}: {req['title']}</h3>")
        debug_info.append(f"<p><strong>Status:</strong> {req['status']}</p>")
        debug_info.append(f"<p><strong>Assigned To:</strong> '{req['assigned_to']}'</p>")
        
        # Test the approval logic using hierarchy function
        can_approve, message = can_approve_request_hierarchy(req['id'], user_department, 'approver')
        debug_info.append(f"<p><strong>Can Approve:</strong> {can_approve}</p>")
        debug_info.append(f"<p><strong>Message:</strong> {message}</p>")
        
        # Show next approver
        next_approver = get_next_approval_level(req['id'])
        debug_info.append(f"<p><strong>Next Approver:</strong> {next_approver}</p>")
        
        # Show approval records
        cursor.execute("""
            SELECT department, signed, signed_by, signed_at
            FROM approvals 
            WHERE request_id = %s
            ORDER BY department
        """, (req['id'],))
        approvals = cursor.fetchall()
        
        debug_info.append("<p><strong>Approval Records:</strong></p>")
        debug_info.append("<ul>")
        for approval in approvals:
            status = "✅ Signed" if approval['signed'] else "⏳ Pending"
            debug_info.append(f"<li>{approval['department']}: {status}")
            if approval['signed_at']:
                debug_info.append(f" (on {approval['signed_at']})")
            debug_info.append("</li>")
        debug_info.append("</ul>")
        debug_info.append("<hr>")
    
    cursor.close()
    
    return "<br>".join(debug_info)

@app.route('/debug/requests')
@login_required
def debug_requests():
    """Debug route to see all requests and their status"""
    cursor = mysql.connection.cursor()
    
    # Get all requests with full details
    cursor.execute("""
        SELECT r.id, r.title, r.status, r.assigned_to, r.created_at,
               u.name as requester_name, u.role as requester_role
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        ORDER BY r.created_at DESC
    """)
    requests = cursor.fetchall()
    
    # Get all approval records
    cursor.execute("""
        SELECT a.request_id, a.department, a.signed, 
               r.title as request_title
        FROM approvals a
        JOIN requests r ON a.request_id = r.id
        ORDER BY a.request_id, a.department
    """)
    approvals = cursor.fetchall()
    
    cursor.close()
    
    debug_info = []
    debug_info.append("<h1>🔍 Request Debug Information</h1>")
    debug_info.append(f"<p><strong>Current User:</strong> {session.get('user_name')} ({session.get('user_role')}) - Department: {session.get('user_department')}</p>")
    debug_info.append("<hr>")
    
    debug_info.append("<h2>📋 All Requests</h2>")
    debug_info.append("<table border='1' style='border-collapse: collapse; width: 100%;'>")
    debug_info.append("<tr style='background: #f0f0f0;'><th>ID</th><th>Title</th><th>Status</th><th>Assigned To</th><th>Requester</th><th>Created</th></tr>")
    
    for req in requests:
        status_color = ""
        if req['status'] == 'draft':
            status_color = "style='background: #fff3cd;'"
        elif req['status'] == 'pending':
            status_color = "style='background: #d1ecf1;'"
        elif req['status'] == 'approved':
            status_color = "style='background: #d4edda;'"
            
        debug_info.append(f"<tr {status_color}>")
        debug_info.append(f"<td>{req['id']}</td>")
        debug_info.append(f"<td>{req['title']}</td>")
        debug_info.append(f"<td><strong>{req['status']}</strong></td>")
        debug_info.append(f"<td>{req['assigned_to']}</td>")
        debug_info.append(f"<td>{req['requester_name']} ({req['requester_role']})</td>")
        debug_info.append(f"<td>{req['created_at']}</td>")
        debug_info.append("</tr>")
    
    debug_info.append("</table>")
    debug_info.append("<hr>")
    
    debug_info.append("<h2>✅ Approval Records</h2>")
    debug_info.append("<table border='1' style='border-collapse: collapse; width: 100%;'>")
    debug_info.append("<tr style='background: #f0f0f0;'><th>Request ID</th><th>Title</th><th>Department</th><th>Signed</th></tr>")
    
    for approval in approvals:
        signed_status = "✅ Yes" if approval['signed'] else "⏳ No"
        debug_info.append("<tr>")
        debug_info.append(f"<td>{approval['request_id']}</td>")
        debug_info.append(f"<td>{approval['request_title']}</td>")
        debug_info.append(f"<td>{approval['department']}</td>")
        debug_info.append(f"<td>{signed_status}</td>")
        debug_info.append("</tr>")
    
    debug_info.append("</table>")
    debug_info.append("<hr>")
    
    # Test approval logic for current user if they're an approver
    if session.get('user_role') == 'approver':
        user_dept = session.get('user_department')
        debug_info.append(f"<h2>🔧 Approval Logic Test for {user_dept}</h2>")
        
        for req in requests:
            if req['status'] in ['pending', 'approved']:
                can_approve, message = can_approve_request_hierarchy(req['id'], user_dept, 'approver')
                next_approver = get_next_approval_level(req['id'])
                
                debug_info.append(f"<h3>Request #{req['id']}: {req['title']}</h3>")
                debug_info.append(f"<p><strong>Assigned to:</strong> {req['assigned_to']}</p>")
                debug_info.append(f"<p><strong>Can I approve?</strong> {can_approve}</p>")
                debug_info.append(f"<p><strong>Reason:</strong> {message}</p>")
                debug_info.append(f"<p><strong>Next approver should be:</strong> {next_approver}</p>")
                debug_info.append("<br>")
    
    debug_info.append("<hr>")
    debug_info.append("<h2>💡 Key Points:</h2>")
    debug_info.append("<ul>")
    debug_info.append("<li><strong>DRAFT requests</strong> will NOT appear in pending approvals</li>") 
    debug_info.append("<li><strong>PENDING requests</strong> will appear for the next approver in hierarchy</li>")
    debug_info.append("<li><strong>Approval hierarchy:</strong> " + " → ".join(APPROVAL_ORDER) + "</li>")
    debug_info.append("</ul>")
    
    return "<br>".join(debug_info)

@app.route('/requests/<int:request_id>/submit', methods=['POST'])
@login_required
def submit_request(request_id):
    """Enhanced submit route with hierarchy-aware approval record creation"""
    cursor = mysql.connection.cursor()
    
    try:
        # Check if user can edit this request
        cursor.execute("""
            SELECT created_by, status, assigned_to FROM requests WHERE id = %s
        """, (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            flash('Request not found', 'error')
            return redirect(url_for('dashboard'))
        
        # Check permissions
        user_role = session.get('user_role')
        user_id = session.get('user_id')
        
        can_edit = (
            (user_role in ['requestor', 'approver'] and request_info['created_by'] == user_id) or
            user_role == 'admin'
        )
        
        if not can_edit:
            flash('You do not have permission to submit this request', 'error')
            return redirect(url_for('dashboard'))
        
        if request_info['status'].lower() != 'draft':
            flash('Only draft requests can be submitted', 'error')
            return redirect(url_for('view_request', request_id=request_id))
        
        # Update status to pending
        cursor.execute("""
            UPDATE requests 
            SET status = 'pending', updated_at = NOW()
            WHERE id = %s
        """, (request_id,))
        
        # Create hierarchy-aware approval records
        cursor.execute("SELECT COUNT(*) as count FROM approvals WHERE request_id = %s", (request_id,))
        approval_count = cursor.fetchone()['count']
        
        if approval_count == 0:
            assigned_departments = []
            if request_info['assigned_to']:
                raw_departments = request_info['assigned_to'].split(',')
                assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
            
            # Handle "All Departments"
            if 'All Departments' in assigned_departments:
                assigned_departments = APPROVAL_ORDER.copy()
            
            # Always ensure ADMIN is the final approver
            if 'ADMIN' not in assigned_departments:
                assigned_departments.append('ADMIN')
            
            print(f"Creating hierarchy-aware approval records for request {request_id}")
            print(f"Assigned departments in hierarchy order: {assigned_departments}")
            
            # Create approval records in hierarchy order
            for dept in APPROVAL_ORDER:
                if dept in assigned_departments:
                    print(f"Creating approval record for: {dept}")
                    cursor.execute("""
                        INSERT INTO approvals (request_id, department, signed, signed_by, 
                                             signed_at, comments, signature)
                        VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                    """, (request_id, dept))
        
        mysql.connection.commit()
        
        # Get next approver for feedback message
        next_approver = get_next_approval_level(request_id)
        if next_approver:
            flash(f'Request submitted successfully! Next approver: {next_approver}', 'success')
        else:
            flash('Request submitted successfully and is now pending approval', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error submitting request: {str(e)}', 'error')
        print(f"Error submitting request {request_id}: {e}")
    finally:
        cursor.close()
    
    return redirect(url_for('view_request', request_id=request_id))

@app.route('/test/submit-all-drafts')
@login_required
@role_required('admin', 'requestor', 'approver')
def test_submit_all_drafts():
    """Test route to submit all draft requests - FOR TESTING ONLY"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get all draft requests
        cursor.execute("SELECT id, title, assigned_to FROM requests WHERE status = 'draft'")
        draft_requests = cursor.fetchall()
        
        results = []
        results.append("<h2>🧪 Test: Submit All Draft Requests</h2>")
        
        for req in draft_requests:
            # Update to pending
            cursor.execute("UPDATE requests SET status = 'pending' WHERE id = %s", (req['id'],))
            
            # Create approval records if needed
            cursor.execute("SELECT COUNT(*) as count FROM approvals WHERE request_id = %s", (req['id'],))
            approval_count = cursor.fetchone()['count']
            
            if approval_count == 0:
                assigned_departments = []
                if req['assigned_to']:
                    raw_departments = req['assigned_to'].split(',')
                    assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
                
                # Create approval records
                for dept in assigned_departments:
                    if dept != 'All Departments':
                        cursor.execute("""
                            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                                 signed_at, comments, signature)
                            VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                        """, (req['id'], dept))
                        results.append(f"✅ Created approval record for Request #{req['id']} ({req['title']}) -> {dept}")
                    else:
                        for dept_name in APPROVAL_ORDER:
                            cursor.execute("""
                                INSERT INTO approvals (request_id, department, signed, signed_by, 
                                                     signed_at, comments, signature)
                                VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                            """, (req['id'], dept_name))
                            results.append(f"✅ Created approval record for Request #{req['id']} ({req['title']}) -> {dept_name}")
            
            results.append(f"📤 Submitted Request #{req['id']}: {req['title']}")
        
        mysql.connection.commit()
        
        if not draft_requests:
            results.append("ℹ️ No draft requests found")
        
        results.append("<hr><p><a href='/dashboard'>← Back to Dashboard</a></p>")
        
        return "<br>".join(results)
        
    except Exception as e:
        mysql.connection.rollback()
        return f"❌ Error: {e}"
    finally:
        cursor.close()
        
@app.route('/test/department/<department>')
@login_required
def test_department_requests(department):
    """Test what requests a specific department should see"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get all requests assigned to this department
        cursor.execute("""
            SELECT r.id, r.title, r.status, r.assigned_to, u.name as requester
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            WHERE r.status IN ('pending', 'approved')
            ORDER BY r.created_at DESC
        """)
        all_requests = cursor.fetchall()
        
        results = []
        results.append(f"<h2>🧪 Test: Requests for {department} Department</h2>")
        results.append(f"<p><strong>Total pending/approved requests:</strong> {len(all_requests)}</p>")
        results.append("<hr>")
        
        department_requests = []
        
        for req in all_requests:
            assigned_departments = []
            if req['assigned_to']:
                raw_departments = req['assigned_to'].split(',')
                assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
            
            if 'All Departments' in assigned_departments:
                assigned_departments = APPROVAL_ORDER.copy()
            
            if department in assigned_departments:
                # Check if already approved
                cursor.execute("""
                    SELECT signed FROM approvals 
                    WHERE request_id = %s AND department = %s
                """, (req['id'], department))
                approval = cursor.fetchone()
                
                already_signed = approval and approval['signed'] == 1
                
                can_approve, reason = can_approve_request_hierarchy(req['id'], department, 'approver')
                
                results.append(f"<h3>Request #{req['id']}: {req['title']}</h3>")
                results.append(f"<p><strong>Status:</strong> {req['status']}</p>")
                results.append(f"<p><strong>Assigned to:</strong> {req['assigned_to']}</p>")
                results.append(f"<p><strong>Requester:</strong> {req['requester']}</p>")
                results.append(f"<p><strong>Already signed by {department}:</strong> {already_signed}</p>")
                results.append(f"<p><strong>Can approve:</strong> {can_approve}</p>")
                results.append(f"<p><strong>Reason:</strong> {reason}</p>")
                
                if can_approve:
                    department_requests.append(req)
                    results.append("<p style='color: green;'>✅ <strong>This request should appear in pending approvals</strong></p>")
                else:
                    results.append("<p style='color: red;'>❌ <strong>This request will NOT appear</strong></p>")
                
                results.append("<hr>")
        
        results.append(f"<h3>Summary</h3>")
        results.append(f"<p><strong>{department} should see {len(department_requests)} requests in pending approvals</strong></p>")
        results.append(f"<p><a href='/pending-approvals'>→ Check Pending Approvals</a></p>")
        results.append(f"<p><a href='/dashboard'>← Back to Dashboard</a></p>")
        
        return "<br>".join(results)
        
    except Exception as e:
        return f"❌ Error: {e}"
    finally:
        cursor.close()
        
@app.route('/requests/<int:request_id>', methods=['GET', 'POST'])
@login_required
def view_request(request_id):
    # Handle comment submission
    if request.method == 'POST' and request.form.get('action') == 'add_comment':
        comment_text = request.form.get('comment')
        if comment_text:
            cursor = mysql.connection.cursor()
            cursor.execute("""
                INSERT INTO comments (request_id, created_by, comment, created_at)
                VALUES (%s, %s, %s, NOW())
            """, (request_id, session['user_id'], comment_text))
            mysql.connection.commit()
            cursor.close()
            flash('Comment added successfully', 'success')
        return redirect(url_for('view_request', request_id=request_id))
    
    cursor = mysql.connection.cursor()
    
    # Get request details - convert to tuple format
    cursor.execute("""
        SELECT r.id, r.title, r.description, r.status, r.assigned_to,
               r.created_at, r.deadline, r.urgent, u.name as requester_name,
               r.created_by
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        WHERE r.id = %s
    """, (request_id,))
    req_dict = cursor.fetchone()
    
    if not req_dict:
        flash('Request not found', 'error')
        return redirect(url_for('dashboard'))
    
    # Check if user can edit this request
    user_role = session.get('user_role')
    user_id = session.get('user_id')
    
    can_edit = (
        (user_role in ['requestor', 'approver'] and req_dict['created_by'] == user_id) or
        user_role == 'admin'
    ) and req_dict['status'].lower() != 'completed'
    
    # Convert to tuple for template
    request_data = (
        req_dict['id'], req_dict['title'], req_dict['description'], 
        req_dict['status'], req_dict['assigned_to'], req_dict['created_at'],
        req_dict['deadline'], req_dict['urgent'], req_dict['requester_name']
    )
    
    # Get approvals in hierarchy order
    cursor.execute("""
        SELECT a.id, a.department, a.signed, a.signed_by, a.signed_at, 
               a.comments, a.signature, u.name as approver_name 
        FROM approvals a 
        LEFT JOIN users u ON a.signed_by = u.id 
        WHERE a.request_id = %s
        ORDER BY FIELD(a.department, 'HR', 'DEAN', 'Accounting', 'IT', 'ADMIN')
    """, (request_id,))
    approvals_dict = cursor.fetchall()
    
    approvals = []
    for app in approvals_dict:
        approvals.append((
            app['id'], app['department'], app['signed'], app['signed_by'],
            app['signed_at'], app['comments'], app['signature'], app['approver_name']
        ))
    
    # ===== ENHANCED: GENERATE REAL SIGNATORIES DATA WITH HIERARCHY =====
    
    # Get assigned departments for this request
    assigned_departments = []
    if req_dict['assigned_to']:
        raw_departments = req_dict['assigned_to'].split(',')
        assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
    
    # Handle "All Departments"
    if 'All Departments' in assigned_departments:
        assigned_departments = APPROVAL_ORDER.copy()
    
    # Always include ADMIN as final approver (unless it's already included)
    if 'ADMIN' not in assigned_departments:
        assigned_departments.append('ADMIN')
    
    # Ensure approval records exist for all assigned departments
    for dept in assigned_departments:
        cursor.execute("""
            INSERT IGNORE INTO approvals (request_id, department, signed, signed_by, 
                                        signed_at, comments, signature)
            VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
        """, (request_id, dept))
    mysql.connection.commit()
    
    # Get current approval status using hierarchy function
    cursor.execute("""
        SELECT a.department, a.signed, a.signed_by, a.signed_at, 
               u.name as approver_name, a.comments
        FROM approvals a 
        LEFT JOIN users u ON a.signed_by = u.id 
        WHERE a.request_id = %s
        ORDER BY FIELD(a.department, 'HR', 'DEAN', 'Accounting', 'IT', 'ADMIN')
    """, (request_id,))
    real_approvals = cursor.fetchall()
    
    # Create signatories list with real data using HIERARCHY ORDER
    signatories = []
    current_user_dept = session.get('user_department')
    current_user_role = session.get('user_role')
    
    # Role titles mapping
    role_titles = {
        'HR': 'HR Director',
        'DEAN': 'Dean',
        'Accounting': 'Finance Manager', 
        'IT': 'IT Manager',
        'ADMIN': 'Administrator'
    }
    
    # Get next approver using hierarchy logic
    next_approver = get_next_approval_level(request_id)
    
    for i, dept in enumerate(APPROVAL_ORDER):
        if dept in assigned_departments:
            # Find approval record for this department
            dept_approval = next((a for a in real_approvals if a['department'] == dept), None)
            
            if dept_approval and dept_approval['signed'] == 1:
                # Already signed
                status = 'signed'
                signed_date = dept_approval['signed_at'].strftime('%Y-%m-%d') if dept_approval['signed_at'] else 'Recently'
                approver_name = dept_approval['approver_name'] or 'Unknown Approver'
            else:
                # Not signed yet - check hierarchy position
                if dept == next_approver:
                    # This is the next department that should approve
                    status = 'current'
                    signed_date = None
                    if dept == 'ADMIN':
                        approver_name = 'Your turn to sign' if current_user_role == 'admin' else 'Awaiting Administrator'
                    else:
                        is_user_turn = (dept == current_user_dept and current_user_role == 'approver')
                        approver_name = 'Your turn to sign' if is_user_turn else f'Awaiting {dept} approval'
                else:
                    # Check if this department is blocked by hierarchy
                    # Look for any higher-level departments that haven't approved yet
                    dept_index = APPROVAL_ORDER.index(dept)
                    blocked = False
                    
                    for j in range(dept_index):
                        prev_dept = APPROVAL_ORDER[j]
                        if prev_dept in assigned_departments:
                            prev_approval = next((a for a in real_approvals if a['department'] == prev_dept), None)
                            if not prev_approval or prev_approval['signed'] != 1:
                                blocked = True
                                break
                    
                    if blocked:
                        status = 'blocked'
                        signed_date = None
                        approver_name = f'Waiting for higher departments'
                    else:
                        status = 'pending'
                        signed_date = None
                        if dept == 'ADMIN':
                            approver_name = 'Awaiting Administrator'
                        else:
                            approver_name = f'Awaiting {dept} approval'
            
            signatories.append({
                'name': approver_name,
                'role': role_titles.get(dept, dept + ' Staff'),
                'status': status,
                'signed_date': signed_date,
                'department': dept,
                'order': i + 1  # Add hierarchy order
            })
    
    # Calculate progress
    signed_count = len([s for s in signatories if s['status'] == 'signed'])
    total_signers = len(signatories)
    progress_percentage = (signed_count / total_signers * 100) if total_signers > 0 else 0
    
    # ===== ENHANCED: HIERARCHY-BASED APPROVAL CHECK =====
    can_approve = False
    approval_message = ""
    
    if user_role in ['approver', 'admin']:
        # Determine the department for approval checking
        user_dept_for_approval = session.get('user_department')
        
        # For admin users, use 'ADMIN' as department
        if user_role == 'admin':
            user_dept_for_approval = 'ADMIN'
        
        try:
            # Use the new hierarchy-based approval function
            can_approve, approval_message = can_approve_request_hierarchy(
                request_id, user_dept_for_approval, user_role
            )
        except Exception as e:
            print(f"Error checking hierarchy approval: {e}")
            can_approve = False
            approval_message = f"Error checking approval permissions: {str(e)}"
    
    # Get documents
    cursor.execute("""
        SELECT id, request_id, name, file_path, uploaded_at, is_initial
        FROM documents 
        WHERE request_id = %s 
        ORDER BY uploaded_at DESC
    """, (request_id,))
    docs_dict = cursor.fetchall()
    
    documents = []
    for doc in docs_dict:
        documents.append((
            doc['id'], doc['request_id'], doc['name'], doc['file_path'],
            doc['uploaded_at'], doc['is_initial']
        ))
    
    # Get comments
    cursor.execute("""
        SELECT c.id, c.comment, c.created_by, c.created_at,
               u.name as commenter_name, u.department 
        FROM comments c 
        JOIN users u ON c.created_by = u.id 
        WHERE c.request_id = %s 
        ORDER BY c.created_at DESC
    """, (request_id,))
    comments_dict = cursor.fetchall()
    
    comments = []
    for com in comments_dict:
        comments.append((
            com['id'], com['comment'], com['created_by'], com['created_at'],
            com['commenter_name'], com['department']
        ))
    
    # Get approval status summary using hierarchy function
    approval_status = get_approval_status_summary_hierarchy(request_id)
    
    # Get completion date for completed requests
    completion_date = None
    if req_dict['status'].lower() == 'completed':
        # Get the latest approval date (should be admin approval)
        cursor.execute("""
            SELECT MAX(signed_at) as completion_date
            FROM approvals 
            WHERE request_id = %s AND signed = 1
        """, (request_id,))
        completion_result = cursor.fetchone()
        if completion_result and completion_result['completion_date']:
            completion_date = completion_result['completion_date']
    
    cursor.close()
    
    return render_template('view_request.html', 
                         request=request_data, 
                         approvals=approvals,
                         documents=documents,
                         comments=comments,
                         can_approve=can_approve,
                         approval_message=approval_message,
                         approval_status=approval_status,
                         hierarchy_order=APPROVAL_ORDER,
                         can_edit=can_edit,
                         # Enhanced hierarchy data for template
                         signatories=signatories,
                         signed_count=signed_count,
                         total_signers=total_signers,
                         progress_percentage=progress_percentage,
                         next_approver=next_approver,
                         completion_date=completion_date)
    
@app.route('/debug/hierarchy/<int:request_id>')
@login_required
def debug_hierarchy(request_id):
    """Debug route to test hierarchy approval logic"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get request info
        cursor.execute("""
            SELECT r.id, r.title, r.assigned_to, r.status
            FROM requests r 
            WHERE r.id = %s
        """, (request_id,))
        request_info = cursor.fetchone()
        
        if not request_info:
            return f"Request #{request_id} not found"
        
        # Get assigned departments
        assigned_departments = []
        if request_info['assigned_to']:
            raw_departments = request_info['assigned_to'].split(',')
            assigned_departments = [dept.strip() for dept in raw_departments if dept.strip()]
        
        if 'All Departments' in assigned_departments:
            assigned_departments = APPROVAL_ORDER.copy()
        
        # Ensure Admin is always included
        if 'ADMIN' not in assigned_departments:
            assigned_departments.append('ADMIN')
        
        # Get approval records
        cursor.execute("""
            SELECT department, signed, signed_by, signed_at
            FROM approvals 
            WHERE request_id = %s
            ORDER BY FIELD(department, 'HR', 'DEAN', 'Accounting', 'IT', 'ADMIN')
        """, (request_id,))
        approvals = cursor.fetchall()
        
        debug_info = []
        debug_info.append(f"<h1>🔍 Hierarchy Debug for Request #{request_id}</h1>")
        debug_info.append(f"<h2>Request: {request_info['title']}</h2>")
        debug_info.append(f"<p><strong>Status:</strong> {request_info['status']}</p>")
        debug_info.append(f"<p><strong>Assigned Departments:</strong> {', '.join(assigned_departments)}</p>")
        debug_info.append(f"<p><strong>Hierarchy Order:</strong> {' → '.join(APPROVAL_ORDER)}</p>")
        
        next_approver = get_next_approval_level(request_id)
        debug_info.append(f"<p><strong>Next Approver:</strong> {next_approver or 'All completed'}</p>")
        debug_info.append("<hr>")
        
        debug_info.append("<h3>Approval Status by Hierarchy Order:</h3>")
        debug_info.append("<table border='1' style='border-collapse: collapse; width: 100%;'>")
        debug_info.append("<tr style='background: #f0f0f0;'><th>Order</th><th>Department</th><th>Status</th><th>Signed By</th><th>Date</th><th>Can Current User Approve?</th></tr>")
        
        current_user_dept = session.get('user_department')
        current_user_role = session.get('user_role')
        
        for i, dept in enumerate(APPROVAL_ORDER):
            if dept in assigned_departments:
                approval = next((a for a in approvals if a['department'] == dept), None)
                
                if approval and approval['signed']:
                    status = "✅ Signed"
                    signed_by = approval['signed_by'] or 'Unknown'
                    signed_date = approval['signed_at'].strftime('%Y-%m-%d %H:%M') if approval['signed_at'] else 'Unknown'
                    row_style = "style='background: #d4edda;'"
                elif dept == next_approver:
                    status = "🔥 NEXT TO SIGN"
                    signed_by = "-"
                    signed_date = "-"
                    row_style = "style='background: #fff3cd;'"
                else:
                    status = "⏳ Waiting"
                    signed_by = "-"
                    signed_date = "-"
                    row_style = "style='background: #f8d7da;'"
                
                # Test if current user can approve this department
                test_dept = dept if dept != 'ADMIN' else current_user_dept
                test_role = current_user_role if dept != 'ADMIN' else 'admin'
                
                if dept == 'ADMIN':
                    can_approve_dept, message = can_approve_request_hierarchy(request_id, 'ADMIN', 'admin')
                else:
                    can_approve_dept, message = can_approve_request_hierarchy(request_id, dept, 'approver')
                
                can_approve_text = f"✅ YES" if can_approve_dept else f"❌ NO: {message}"
                
                debug_info.append(f"<tr {row_style}>")
                debug_info.append(f"<td>{i + 1}</td>")
                debug_info.append(f"<td><strong>{dept}</strong></td>")
                debug_info.append(f"<td>{status}</td>")
                debug_info.append(f"<td>{signed_by}</td>")
                debug_info.append(f"<td>{signed_date}</td>")
                debug_info.append(f"<td>{can_approve_text}</td>")
                debug_info.append("</tr>")
        
        debug_info.append("</table>")
        debug_info.append("<hr>")
        
        debug_info.append("<h3>Key Rules:</h3>")
        debug_info.append("<ul>")
        debug_info.append("<li>✅ <strong>Strict hierarchy:</strong> Each department must wait for the previous one to approve</li>")
        debug_info.append("<li>🔐 <strong>Admin is final:</strong> Admin can only approve after ALL other departments</li>")
        debug_info.append("<li>🚫 <strong>No skipping:</strong> Cannot approve if any higher-level department hasn't signed</li>")
        debug_info.append("<li>📋 <strong>Order matters:</strong> Must follow HR → DEAN → Accounting → IT → ADMIN</li>")
        debug_info.append("</ul>")
        
        debug_info.append(f"<p><a href='/requests/{request_id}'>→ View Request</a></p>")
        
        return "<br>".join(debug_info)
        
    except Exception as e:
        return f"❌ Error: {e}"
    finally:
        cursor.close()

@app.route('/requests/<int:request_id>/approve', methods=['POST'])
@login_required
@role_required('approver', 'admin')
def approve_request(request_id):
    user_department = session.get('user_department')
    user_role = session.get('user_role')
    
    # For admin, use 'ADMIN' as department
    if user_role == 'admin':
        user_department = 'ADMIN'
    
    # Check if this user can approve using hierarchy logic
    can_approve, message = can_approve_request_hierarchy(request_id, user_department, user_role)
    if not can_approve:
        flash(f'Cannot approve: {message}', 'error')
        return redirect(url_for('view_request', request_id=request_id))
    
    comment = request.form.get('comment')
    signature_data = request.form.get('signature')
    
    cursor = mysql.connection.cursor()
    
    try:
        # Update the approval for this department
        cursor.execute("""
            UPDATE approvals 
            SET signed = 1, signed_by = %s, signed_at = NOW(), 
                comments = %s, signature = %s
            WHERE request_id = %s AND department = %s
        """, (session['user_id'], comment, signature_data, request_id, user_department))
        
        # Check if this is the final approval (Admin)
        if user_department == 'ADMIN':
            cursor.execute("""
                UPDATE requests 
                SET status = 'completed', updated_at = NOW()
                WHERE id = %s
            """, (request_id,))
            flash('🎉 Request fully approved and completed by Administrator!', 'success')
        else:
            # Update request status to approved and check what's next
            cursor.execute("""
                UPDATE requests 
                SET status = 'approved', updated_at = NOW()
                WHERE id = %s
            """, (request_id,))
            
            next_approver = get_next_approval_level(request_id)
            if next_approver:
                if next_approver == 'ADMIN':
                    flash(f'✅ Request approved by {user_department}. Awaiting final Administrator approval.', 'success')
                else:
                    flash(f'✅ Request approved by {user_department}. Next: {next_approver} department.', 'success')
            else:
                flash(f'✅ Request approved by {user_department}.', 'success')
        
        mysql.connection.commit()
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error processing approval: {str(e)}', 'error')
        print(f"Error in approve_request: {e}")
    finally:
        cursor.close()
    
    return redirect(url_for('view_request', request_id=request_id))

@app.route('/requests/<int:request_id>/reject', methods=['POST'])
@login_required
@role_required('approver')
def reject_request(request_id):
    user_department = session.get('user_department')
    
    # Check if this department can approve/reject based on hierarchy
    can_approve, message = can_approve_request_hierarchy(request_id, user_department, 'approver')
    if not can_approve:
        flash(f'Cannot reject: {message}', 'error')
        return redirect(url_for('view_request', request_id=request_id))
    
    comment = request.form.get('comment')
    
    cursor = mysql.connection.cursor()
    
    # Update request status to rejected
    cursor.execute("""
        UPDATE requests 
        SET status = 'rejected', updated_at = NOW()
        WHERE id = %s
    """, (request_id,))
    
    # Update the approval record for this department
    cursor.execute("""
        UPDATE approvals 
        SET signed = 0, signed_by = %s, signed_at = NOW(), comments = %s
        WHERE request_id = %s AND department = %s
    """, (session['user_id'], comment, request_id, user_department))
    
    mysql.connection.commit()
    cursor.close()
    
    flash(f'Request rejected by {user_department}', 'warning')
    return redirect(url_for('view_request', request_id=request_id))


@app.route('/requests/<int:request_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_request(request_id):
    cursor = mysql.connection.cursor()
    
    # Get request details
    cursor.execute("""
        SELECT r.id, r.title, r.description, r.status, r.assigned_to,
               r.created_at, r.deadline, r.urgent, u.name as requester_name,
               r.created_by
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        WHERE r.id = %s
    """, (request_id,))
    req_dict = cursor.fetchone()
    
    if not req_dict:
        flash('Request not found', 'error')
        return redirect(url_for('dashboard'))
    
    # Check if user can edit this request
    user_role = session.get('user_role')
    user_id = session.get('user_id')
    
    # Only allow editing if:
    # 1. User is the requestor who created it, OR
    # 2. User is admin, OR  
    # 3. Request is not completed
    can_edit = (
        (user_role in ['requestor', 'approver'] and req_dict['created_by'] == user_id) or
        user_role == 'admin'
    ) and req_dict['status'].lower() != 'completed'
    
    if not can_edit:
        if req_dict['status'].lower() == 'completed':
            flash('Cannot edit completed requests', 'error')
        else:
            flash('You do not have permission to edit this request', 'error')
        return redirect(url_for('view_request', request_id=request_id))
    
    if request.method == 'POST':
        title = request.form['title']
        description = request.form['description']
        deadline = request.form.get('deadline')
        urgent = 1 if 'urgent' in request.form else 0
        status = request.form.get('status', req_dict['status'])
        
        # Handle multiple department assignments
        assigned_departments = request.form.getlist('assigned_to')
        if not assigned_departments:
            flash('Please select at least one department', 'error')
            return redirect(url_for('edit_request', request_id=request_id))
        
        # Convert list to comma-separated string for storage
        assigned_to = ','.join(assigned_departments)
        
        # Update request
        cursor.execute("""
            UPDATE requests 
            SET title = %s, description = %s, deadline = %s, urgent = %s, 
                assigned_to = %s, status = %s, updated_at = NOW()
            WHERE id = %s
        """, (title, description, deadline, urgent, assigned_to, status, request_id))
        
        # If status changed to pending and there are no approval records, create them
        if status == 'pending':
            cursor.execute("SELECT COUNT(*) as count FROM approvals WHERE request_id = %s", (request_id,))
            approval_count = cursor.fetchone()['count']
            
            if approval_count == 0:
                # Create approval records for each assigned department
                for dept in assigned_departments:
                    if dept != 'All Departments':
                        cursor.execute("""
                            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                                 signed_at, comments, signature)
                            VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                        """, (request_id, dept))
                    else:
                        # If "All Departments" is selected, create records for all departments in hierarchy
                        for dept_name in APPROVAL_ORDER:
                            cursor.execute("""
                                INSERT INTO approvals (request_id, department, signed, signed_by, 
                                                     signed_at, comments, signature)
                                VALUES (%s, %s, 0, NULL, NULL, NULL, NULL)
                            """, (request_id, dept_name))
        
        # Handle additional file uploads
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
                    # Add timestamp to filename to avoid conflicts
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f"{timestamp}_{filename}"
                    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                    file.save(filepath)
                    
                    # Save file info to database
                    cursor.execute("""
                        INSERT INTO documents (request_id, name, file_path, 
                                             uploaded_at, is_initial)
                        VALUES (%s, %s, %s, NOW(), 0)
                    """, (request_id, filename, filepath))
        
        mysql.connection.commit()
        flash('Request updated successfully', 'success')
        return redirect(url_for('view_request', request_id=request_id))
    
    # Convert request dict to tuple format for template compatibility
    request_data = (
        req_dict['id'], req_dict['title'], req_dict['description'], 
        req_dict['status'], req_dict['assigned_to'], req_dict['created_at'],
        req_dict['deadline'], req_dict['urgent'], req_dict['requester_name']
    )
    
    # Get documents
    cursor.execute("""
        SELECT id, request_id, name, file_path, uploaded_at, is_initial
        FROM documents 
        WHERE request_id = %s 
        ORDER BY uploaded_at DESC
    """, (request_id,))
    docs_dict = cursor.fetchall()
    
    documents = []
    for doc in docs_dict:
        documents.append((
            doc['id'], doc['request_id'], doc['name'], doc['file_path'],
            doc['uploaded_at'], doc['is_initial']
        ))
    
    # Get departments for checklist
    cursor.execute("SELECT DISTINCT department FROM users WHERE role = 'approver' AND department IS NOT NULL")
    departments = [row['department'] for row in cursor.fetchall()]
    
    cursor.close()
    
    return render_template('edit_request.html', 
                         request=request_data, 
                         documents=documents,
                         departments=departments)
    
@app.route('/requests/<int:request_id>/remove-document', methods=['POST'])
@login_required
def remove_document(request_id):
    document_id = request.form.get('document_id')
    
    if not document_id:
        flash('Invalid document ID', 'error')
        return redirect(url_for('edit_request', request_id=request_id))
    
    cursor = mysql.connection.cursor()
    
    # Check if user can edit this request (same logic as edit_request)
    cursor.execute("""
        SELECT created_by, status FROM requests WHERE id = %s
    """, (request_id,))
    request_info = cursor.fetchone()
    
    if not request_info:
        flash('Request not found', 'error')
        return redirect(url_for('dashboard'))
    
    user_role = session.get('user_role')
    user_id = session.get('user_id')
    
    can_edit = (
        (user_role in ['requestor', 'approver'] and request_info['created_by'] == user_id) or
        user_role == 'admin'
    ) and request_info['status'].lower() != 'completed'
    
    if not can_edit:
        flash('You do not have permission to remove documents from this request', 'error')
        return redirect(url_for('view_request', request_id=request_id))
    
    # Get document info before deleting
    cursor.execute("""
        SELECT name, file_path FROM documents 
        WHERE id = %s AND request_id = %s
    """, (document_id, request_id))
    document = cursor.fetchone()
    
    if document:
        # Delete file from filesystem
        try:
            if os.path.exists(document['file_path']):
                os.remove(document['file_path'])
        except Exception as e:
            print(f"Error deleting file: {e}")
        
        # Delete from database
        cursor.execute("""
            DELETE FROM documents WHERE id = %s AND request_id = %s
        """, (document_id, request_id))
        
        mysql.connection.commit()
        flash(f'Document "{document["name"]}" removed successfully', 'success')
    else:
        flash('Document not found', 'error')
    
    cursor.close()
    return redirect(url_for('edit_request', request_id=request_id))

@app.route('/admin/users/<int:user_id>/archive', methods=['POST'])
@login_required
@role_required('admin')
def archive_user(user_id):
    """Archive a user (soft delete)"""
    # Prevent archiving own account
    if user_id == session.get('user_id'):
        flash('You cannot archive your own account', 'error')
        return redirect(url_for('user_management'))
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get username for confirmation message
        cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            flash('User not found', 'error')
            return redirect(url_for('user_management'))
        
        username = user['username']
        
        # Archive user (soft delete)
        cursor.execute("""
            UPDATE users 
            SET archived = TRUE, archived_at = NOW() 
            WHERE id = %s
        """, (user_id,))
        mysql.connection.commit()
        
        flash(f'User {username} has been archived successfully', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error archiving user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))

@app.route('/admin/users/<int:user_id>/restore', methods=['POST'])
@login_required
@role_required('admin')
def restore_user(user_id):
    """Restore an archived user"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get username for confirmation message
        cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            flash('User not found', 'error')
            return redirect(url_for('user_management'))
        
        username = user['username']
        
        # Restore user
        cursor.execute("""
            UPDATE users 
            SET archived = FALSE, archived_at = NULL 
            WHERE id = %s
        """, (user_id,))
        mysql.connection.commit()
        
        flash(f'User {username} has been restored successfully', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error restoring user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))

@app.route('/admin/users/<int:user_id>/permanent-delete', methods=['POST'])
@login_required
@role_required('admin')
def permanent_delete_user(user_id):
    """Permanently delete a user"""
    # Prevent deleting own account
    if user_id == session.get('user_id'):
        flash('You cannot delete your own account', 'error')
        return redirect(url_for('user_management'))
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get username for confirmation message
        cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            flash('User not found', 'error')
            return redirect(url_for('user_management'))
        
        username = user['username']
        
        # Permanently delete user
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        mysql.connection.commit()
        
        flash(f'User {username} has been permanently deleted', 'warning')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error deleting user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))

# Update the existing user_management route to handle archived users
@app.route('/users')
@login_required
@role_required('admin')
def user_management():
    """Enhanced user management page with counts and department info"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get all users (including archived)
        cursor.execute("""
            SELECT id, username, name, role, department, email, created_at, 
                   archived, archived_at
            FROM users 
            ORDER BY archived ASC, created_at DESC
        """)
        users = cursor.fetchall()
        
        # Get counts for overview boxes
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE archived = FALSE OR archived IS NULL")
        user_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'approver' AND (archived = FALSE OR archived IS NULL)")
        approver_count = cursor.fetchone()['count']
        
        # Count unique departments (non-archived users only)
        cursor.execute("SELECT COUNT(DISTINCT department) as count FROM users WHERE department IS NOT NULL AND (archived = FALSE OR archived IS NULL)")
        department_count = cursor.fetchone()['count']
        
        # Count archived users
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE archived = TRUE")
        archived_count = cursor.fetchone()['count']
        
        cursor.close()
        
        return render_template('user_management.html',
                             users=users,
                             user_count=user_count,
                             approver_count=approver_count,
                             department_count=department_count,
                             archived_count=archived_count)
    
    except Exception as e:
        cursor.close()
        flash(f'Error loading users: {str(e)}', 'error')
        return redirect(url_for('dashboard'))

# Update the get_user_details route to include archived information
@app.route('/admin/users/<int:user_id>/details')
@login_required
@role_required('admin')
def get_user_details(user_id):
    """Get user details for editing (AJAX endpoint)"""
    cursor = mysql.connection.cursor()
    
    try:
        cursor.execute("""
            SELECT id, username, name, role, department, email, created_at,
                   archived, archived_at
            FROM users 
            WHERE id = %s
        """, (user_id,))
        user = cursor.fetchone()
        
        if user:
            return jsonify({
                'id': user['id'],
                'username': user['username'],
                'name': user['name'],
                'role': user['role'],
                'department': user['department'],
                'email': user['email'],
                'created_at': user['created_at'].strftime('%b %d, %Y') if user['created_at'] else None,
                'archived': user['archived'],
                'archived_at': user['archived_at'].strftime('%b %d, %Y') if user['archived_at'] else None
            })
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()

@app.route('/admin/users/create', methods=['POST'])
@login_required
@role_required('admin')
def create_user():
    """Create a new user"""
    username = request.form.get('username')
    name = request.form.get('name')
    email = request.form.get('email')
    password = request.form.get('password')
    role = request.form.get('role')
    department = request.form.get('department')
    
    # Validate required fields
    if not all([username, name, password, role]):
        flash('Please fill in all required fields', 'error')
        return redirect(url_for('user_management'))
    
    # Admin role doesn't need department
    if role == 'admin':
        department = None
    elif not department:
        flash('Department is required for Requestors and Approvers', 'error')
        return redirect(url_for('user_management'))
    
    cursor = mysql.connection.cursor()
    
    try:
        # Check if username already exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            flash('Username already exists', 'error')
            return redirect(url_for('user_management'))
        
        # Insert new user
        cursor.execute("""
            INSERT INTO users (username, name, password, role, department, email, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (username, name, password, role, department, email))
        
        mysql.connection.commit()
        flash(f'User {username} created successfully', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error creating user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))

@app.route('/admin/users/update', methods=['POST'])
@login_required
@role_required('admin')
def update_user():
    """Update existing user"""
    user_id = request.form.get('user_id')
    name = request.form.get('name')
    email = request.form.get('email')
    role = request.form.get('role')
    department = request.form.get('department')
    password = request.form.get('password')
    
    if not user_id:
        flash('Invalid user ID', 'error')
        return redirect(url_for('user_management'))
    
    # Admin role doesn't need department
    if role == 'admin':
        department = None
    
    cursor = mysql.connection.cursor()
    
    try:
        # Build update query dynamically
        update_fields = []
        params = []
        
        if name:
            update_fields.append("name = %s")
            params.append(name)
        
        if email:
            update_fields.append("email = %s")
            params.append(email)
        
        if role:
            update_fields.append("role = %s")
            params.append(role)
        
        update_fields.append("department = %s")
        params.append(department)
        
        if password:  # Only update password if provided
            update_fields.append("password = %s")
            params.append(password)
        
        # Add updated_at timestamp
        update_fields.append("updated_at = NOW()")
        
        # Add user_id to params
        params.append(user_id)
        
        # Execute update
        query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
        cursor.execute(query, params)
        
        mysql.connection.commit()
        flash('User updated successfully', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error updating user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))

@app.route('/admin/users/<int:user_id>/delete', methods=['POST'])
@login_required
@role_required('admin')
def delete_user(user_id):
    """Delete a user"""
    # Prevent deleting own account
    if user_id == session.get('user_id'):
        flash('You cannot delete your own account', 'error')
        return redirect(url_for('user_management'))
    
    cursor = mysql.connection.cursor()
    
    try:
        # Get username for confirmation message
        cursor.execute("SELECT username FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            flash('User not found', 'error')
            return redirect(url_for('user_management'))
        
        username = user['username']
        
        # Delete user (cascading deletes will handle related records)
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        mysql.connection.commit()
        
        flash(f'User {username} deleted successfully', 'success')
        
    except Exception as e:
        mysql.connection.rollback()
        flash(f'Error deleting user: {str(e)}', 'error')
    finally:
        cursor.close()
    
    return redirect(url_for('user_management'))


# Helper function to download documents
@app.route('/download/<int:doc_id>')
@login_required
def download_document(doc_id):
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT id, request_id, name, file_path FROM documents WHERE id = %s", (doc_id,))
    document = cursor.fetchone()
    cursor.close()
    
    if document and os.path.exists(document['file_path']):
        return send_file(document['file_path'], as_attachment=True, download_name=document['name'])
    else:
        flash('Document not found', 'error')
        return redirect(url_for('dashboard'))

if __name__ == '__main__':
    app.run(debug=True)