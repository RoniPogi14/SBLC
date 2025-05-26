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
app.config['MYSQL_PASSWORD'] = 'tzulife22'
app.config['MYSQL_DB'] = 'digitaldocument'
app.config['MYSQL_CURSORCLASS'] = 'DictCursor'

# File Upload Configuration
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

mysql = MySQL(app)

# Ensure upload folder exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

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
    
    return render_template('home.html', recent_requests=recent_requests)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        cursor = mysql.connection.cursor()
        cursor.execute("SELECT * FROM users WHERE username = %s AND password = %s", 
                      (username, password))
        user = cursor.fetchone()
        cursor.close()
        
        if user:
            session['user_id'] = user['id']
            session['user_name'] = user['name']
            session['user_role'] = user['role']
            session['user_department'] = user['department']
            return redirect(url_for('dashboard'))
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
    
    cursor = mysql.connection.cursor()
    
    if user_role == 'requestor':
        # Get requestor's requests - using tuple format for template compatibility
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
        
        # Convert to tuples for template
        requests = []
        for req in dict_requests:
            requests.append((
                req['id'], req['title'], req['description'], req['status'],
                req['assigned_to'], req['created_at'], req['deadline'],
                req['urgent'], req['document_count']
            ))
        
        # Get counts for different statuses
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
            FROM requests 
            WHERE created_by = %s
        """, (user_id,))
        counts_dict = cursor.fetchone()
        counts = (counts_dict['draft_count'], counts_dict['pending_count'], counts_dict['approved_count'])
        pending_count = None
        
    elif user_role == 'approver':
        department = session.get('user_department')
        
        # Get pending approvals for department
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            LEFT JOIN approvals a ON r.id = a.request_id AND a.department = %s
            WHERE r.status = 'pending' 
            AND (r.assigned_to = %s OR r.assigned_to = 'All Departments')
            AND (a.signed = 0 OR a.signed IS NULL)
            ORDER BY r.created_at DESC 
            LIMIT 5
        """, (department, department))
        dict_requests = cursor.fetchall()
        
        # Convert to tuples for template
        requests = []
        for req in dict_requests:
            requests.append((
                req['id'], req['title'], req['description'], req['status'],
                req['assigned_to'], req['created_at'], req['deadline'],
                req['urgent'], req['requester_name']
            ))
        
        # Get pending count
        cursor.execute("""
            SELECT COUNT(DISTINCT r.id) as pending_count
            FROM requests r 
            LEFT JOIN approvals a ON r.id = a.request_id AND a.department = %s
            WHERE r.status = 'pending' 
            AND (r.assigned_to = %s OR r.assigned_to = 'All Departments')
            AND (a.signed = 0 OR a.signed IS NULL)
        """, (department, department))
        pending_count = cursor.fetchone()['pending_count']
        counts = None
        
    elif user_role == 'admin':
        # Get all requests
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        """)
        dict_requests = cursor.fetchall()
        
        # Convert to tuples for template
        requests = []
        for req in dict_requests:
            requests.append((
                req['id'], req['title'], req['description'], req['status'],
                req['assigned_to'], req['created_at'], req['deadline'],
                req['urgent'], req['requester_name']
            ))
        
        # Get counts
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                COUNT(*) as total_count
            FROM requests
        """)
        counts_dict = cursor.fetchone()
        counts = (counts_dict['pending_count'], counts_dict['approved_count'], counts_dict['total_count'])
        pending_count = None
    
    cursor.close()
    
    # Use unified dashboard template
    return render_template('dashboard.html', 
                         requests=requests, 
                         counts=counts,
                         pending_count=pending_count)

@app.route('/my-requests')
@login_required
@role_required('requestor')
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
    department = session.get('user_department')
    
    cursor = mysql.connection.cursor()
    cursor.execute("""
        SELECT r.id, r.title, r.description, r.status, r.assigned_to,
               r.created_at, r.deadline, r.urgent, u.name as requester_name 
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        LEFT JOIN approvals a ON r.id = a.request_id AND a.department = %s
        WHERE r.status = 'pending' 
        AND (r.assigned_to = %s OR r.assigned_to = 'All Departments')
        AND (a.signed = 0 OR a.signed IS NULL)
        ORDER BY r.urgent DESC, r.created_at DESC
    """, (department, department))
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
        # Approvers see requests for their department
        department = session.get('user_department')
        cursor.execute("""
            SELECT r.id, r.title, r.description, r.status, r.assigned_to,
                   r.created_at, r.deadline, r.urgent, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            WHERE r.assigned_to = %s OR r.assigned_to = 'All Departments'
            ORDER BY r.created_at DESC
        """, (department,))
    
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
@role_required('requestor')
def new_request():
    if request.method == 'POST':
        title = request.form['title']
        description = request.form['description']
        deadline = request.form.get('deadline')
        urgent = 1 if 'urgent' in request.form else 0
        status = request.form.get('status', 'draft')
        assigned_to = request.form.get('assigned_to')  # Department selection
        
        cursor = mysql.connection.cursor()
        
        # Insert request
        cursor.execute("""
            INSERT INTO requests (title, description, status, created_by, 
                                deadline, urgent, assigned_to, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
        """, (title, description, status, session['user_id'], deadline, urgent, assigned_to))
        
        request_id = cursor.lastrowid
        
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
    
    # Get departments for dropdown
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT DISTINCT department FROM users WHERE role = 'approver' AND department IS NOT NULL")
    departments = [row['department'] for row in cursor.fetchall()]
    cursor.close()
    
    return render_template('new_request.html', departments=departments)

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
               r.created_at, r.deadline, r.urgent, u.name as requester_name 
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        WHERE r.id = %s
    """, (request_id,))
    req_dict = cursor.fetchone()
    
    if not req_dict:
        flash('Request not found', 'error')
        return redirect(url_for('dashboard'))
    
    # Convert to tuple for template
    request_data = (
        req_dict['id'], req_dict['title'], req_dict['description'], 
        req_dict['status'], req_dict['assigned_to'], req_dict['created_at'],
        req_dict['deadline'], req_dict['urgent'], req_dict['requester_name']
    )
    
    # Get approvals - convert to tuple format
    cursor.execute("""
        SELECT a.id, a.department, a.signed, a.signed_by, a.signed_at, 
               a.comments, a.signature, u.name as approver_name 
        FROM approvals a 
        LEFT JOIN users u ON a.signed_by = u.id 
        WHERE a.request_id = %s
    """, (request_id,))
    approvals_dict = cursor.fetchall()
    
    approvals = []
    for app in approvals_dict:
        approvals.append((
            app['id'], app['department'], app['signed'], app['signed_by'],
            app['signed_at'], app['comments'], app['signature'], app['approver_name']
        ))
    
    # Get documents - convert to tuple format
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
    
    # Get comments - convert to tuple format
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
    
    cursor.close()
    
    return render_template('view_request.html', 
                         request=request_data, 
                         approvals=approvals,
                         documents=documents,
                         comments=comments)

@app.route('/requests/<int:request_id>/approve', methods=['POST'])
@login_required
@role_required('approver')
def approve_request(request_id):
    comment = request.form.get('comment')
    signature_data = request.form.get('signature')
    department = session.get('user_department')
    
    cursor = mysql.connection.cursor()
    
    # Check if approval already exists
    cursor.execute("""
        SELECT id FROM approvals 
        WHERE request_id = %s AND department = %s
    """, (request_id, department))
    existing_approval = cursor.fetchone()
    
    if existing_approval:
        # Update existing approval
        cursor.execute("""
            UPDATE approvals 
            SET signed = 1, signed_by = %s, signed_at = NOW(), 
                comments = %s, signature = %s
            WHERE id = %s
        """, (session['user_id'], comment, signature_data, existing_approval['id']))
    else:
        # Create new approval
        cursor.execute("""
            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                 signed_at, comments, signature)
            VALUES (%s, %s, 1, %s, NOW(), %s, %s)
        """, (request_id, department, session['user_id'], comment, signature_data))
    
    # Check if all departments have approved
    cursor.execute("""
        SELECT COUNT(*) as count FROM approvals 
        WHERE request_id = %s AND signed = 1
    """, (request_id,))
    approval_count = cursor.fetchone()['count']
    
    # If all departments approved, update request status
    if approval_count >= 5:  # IT, DEAN, ADMIN, Accounting, HR
        cursor.execute("""
            UPDATE requests 
            SET status = 'completed', updated_at = NOW()
            WHERE id = %s
        """, (request_id,))
    else:
        cursor.execute("""
            UPDATE requests 
            SET status = 'approved', updated_at = NOW()
            WHERE id = %s
        """, (request_id,))
    
    mysql.connection.commit()
    cursor.close()
    
    flash('Request approved successfully', 'success')
    return redirect(url_for('view_request', request_id=request_id))

@app.route('/requests/<int:request_id>/reject', methods=['POST'])
@login_required
@role_required('approver')
def reject_request(request_id):
    comment = request.form.get('comment')
    department = session.get('user_department')
    
    cursor = mysql.connection.cursor()
    
    # Update request status
    cursor.execute("""
        UPDATE requests 
        SET status = 'rejected', updated_at = NOW()
        WHERE id = %s
    """, (request_id,))
    
    # Check if approval record exists
    cursor.execute("""
        SELECT id FROM approvals 
        WHERE request_id = %s AND department = %s
    """, (request_id, department))
    existing_approval = cursor.fetchone()
    
    if existing_approval:
        # Update existing approval
        cursor.execute("""
            UPDATE approvals 
            SET signed = 0, signed_by = %s, signed_at = NOW(), comments = %s
            WHERE id = %s
        """, (session['user_id'], comment, existing_approval['id']))
    else:
        # Create new approval record
        cursor.execute("""
            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                 signed_at, comments)
            VALUES (%s, %s, 0, %s, NOW(), %s)
        """, (request_id, department, session['user_id'], comment))
    
    mysql.connection.commit()
    cursor.close()
    
    flash('Request rejected', 'warning')
    return redirect(url_for('view_request', request_id=request_id))

@app.route('/users')
@login_required
@role_required('admin')
def user_management():
    """Enhanced user management page with counts and department info"""
    cursor = mysql.connection.cursor()
    
    try:
        # Get all users
        cursor.execute("""
            SELECT id, username, name, role, department, email, created_at 
            FROM users 
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        
        # Get counts for overview boxes
        cursor.execute("SELECT COUNT(*) as count FROM users")
        user_count = cursor.fetchone()['count']
        
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role = 'approver'")
        approver_count = cursor.fetchone()['count']
        
        # Count unique departments
        cursor.execute("SELECT COUNT(DISTINCT department) as count FROM users WHERE department IS NOT NULL")
        department_count = cursor.fetchone()['count']
        
        cursor.close()
        
        return render_template('user_management.html',
                             users=users,
                             user_count=user_count,
                             approver_count=approver_count,
                             department_count=department_count)
    
    except Exception as e:
        cursor.close()
        flash(f'Error loading users: {str(e)}', 'error')
        return redirect(url_for('dashboard'))

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

@app.route('/admin/users/<int:user_id>/details')
@login_required
@role_required('admin')
def get_user_details(user_id):
    """Get user details for editing (AJAX endpoint)"""
    cursor = mysql.connection.cursor()
    
    try:
        cursor.execute("""
            SELECT id, username, name, role, department, email 
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
                'email': user['email']
            })
        else:
            return jsonify({'error': 'User not found'}), 404
            
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        cursor.close()

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