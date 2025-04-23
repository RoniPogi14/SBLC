# Flask Application Structure for Document Request System

# app.py
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify
from flask_mysqldb import MySQL
import os
import base64
from werkzeug.utils import secure_filename
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'your_secret_key_here'  # Change this to a secure key

# MySQL Configuration
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = 'sblc2025'
app.config['MYSQL_DB'] = 'document_request_system'

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
            session['user_id'] = user[0]
            session['user_name'] = user[1]
            session['user_role'] = user[4]
            session['user_department'] = user[5]
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
        # Get requestor's requests
        cursor.execute("""
            SELECT r.*, COUNT(d.id) as document_count 
            FROM requests r 
            LEFT JOIN documents d ON r.id = d.request_id 
            WHERE r.created_by = %s 
            GROUP BY r.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        """, (user_id,))
        requests = cursor.fetchall()
        
        # Get counts for different statuses
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft_count,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count
            FROM requests 
            WHERE created_by = %s
        """, (user_id,))
        counts = cursor.fetchone()
        
        cursor.close()
        return render_template('dashboard_requestor.html', 
                             requests=requests, 
                             counts=counts)
                             
    elif user_role == 'approver':
        department = session.get('user_department')
        
        # Get pending approvals for department
        cursor.execute("""
            SELECT r.*, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            LEFT JOIN approvals a ON r.id = a.request_id AND a.department = %s
            WHERE r.status = 'pending' 
            AND (r.assigned_to = %s OR r.assigned_to = 'All Departments')
            AND (a.signed = 0 OR a.signed IS NULL)
            ORDER BY r.created_at DESC 
            LIMIT 5
        """, (department, department))
        requests = cursor.fetchall()
        
        # Get counts
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT r.id) as pending_count
            FROM requests r 
            LEFT JOIN approvals a ON r.id = a.request_id AND a.department = %s
            WHERE r.status = 'pending' 
            AND (r.assigned_to = %s OR r.assigned_to = 'All Departments')
            AND (a.signed = 0 OR a.signed IS NULL)
        """, (department, department))
        pending_count = cursor.fetchone()[0]
        
        cursor.close()
        return render_template('dashboard_approver.html', 
                             requests=requests, 
                             pending_count=pending_count,
                             department=department)
                             
    elif user_role == 'admin':
        # Get all requests
        cursor.execute("""
            SELECT r.*, u.name as requester_name 
            FROM requests r 
            JOIN users u ON r.created_by = u.id 
            ORDER BY r.created_at DESC 
            LIMIT 5
        """)
        requests = cursor.fetchall()
        
        # Get counts
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                COUNT(*) as total_count
            FROM requests
        """)
        counts = cursor.fetchone()
        
        cursor.close()
        return render_template('dashboard_admin.html', 
                             requests=requests, 
                             counts=counts)
    
    return redirect(url_for('login'))

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
        
        cursor = mysql.connection.cursor()
        
        # Insert request
        cursor.execute("""
            INSERT INTO requests (title, description, status, created_by, 
                                deadline, urgent, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NOW())
        """, (title, description, status, session['user_id'], deadline, urgent))
        
        request_id = cursor.lastrowid
        
        # Handle file upload
        if 'files' in request.files:
            files = request.files.getlist('files')
            for file in files:
                if file.filename:
                    filename = secure_filename(file.filename)
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
    
    return render_template('new_request.html')

@app.route('/requests/<int:request_id>')
@login_required
def view_request(request_id):
    cursor = mysql.connection.cursor()
    
    # Get request details
    cursor.execute("""
        SELECT r.*, u.name as requester_name 
        FROM requests r 
        JOIN users u ON r.created_by = u.id 
        WHERE r.id = %s
    """, (request_id,))
    request_data = cursor.fetchone()
    
    if not request_data:
        flash('Request not found', 'error')
        return redirect(url_for('dashboard'))
    
    # Get approvals
    cursor.execute("""
        SELECT a.*, u.name as approver_name 
        FROM approvals a 
        LEFT JOIN users u ON a.signed_by = u.id 
        WHERE a.request_id = %s
    """, (request_id,))
    approvals = cursor.fetchall()
    
    # Get documents
    cursor.execute("""
        SELECT * FROM documents 
        WHERE request_id = %s 
        ORDER BY uploaded_at DESC
    """, (request_id,))
    documents = cursor.fetchall()
    
    # Get comments
    cursor.execute("""
        SELECT c.*, u.name as commenter_name, u.department 
        FROM comments c 
        JOIN users u ON c.created_by = u.id 
        WHERE c.request_id = %s 
        ORDER BY c.created_at DESC
    """, (request_id,))
    comments = cursor.fetchall()
    
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
        """, (session['user_id'], comment, signature_data, existing_approval[0]))
    else:
        # Create new approval
        cursor.execute("""
            INSERT INTO approvals (request_id, department, signed, signed_by, 
                                 signed_at, comments, signature)
            VALUES (%s, %s, 1, %s, NOW(), %s, %s)
        """, (request_id, department, session['user_id'], comment, signature_data))
    
    # Check if all departments have approved
    cursor.execute("""
        SELECT COUNT(*) FROM approvals 
        WHERE request_id = %s AND signed = 1
    """, (request_id,))
    approval_count = cursor.fetchone()[0]
    
    # If all departments approved, update request status
    if approval_count >= 4:  # Assuming 4 departments
        cursor.execute("""
            UPDATE requests 
            SET status = 'completed' 
            WHERE id = %s
        """, (request_id,))
    else:
        cursor.execute("""
            UPDATE requests 
            SET status = 'approved' 
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
        SET status = 'rejected' 
        WHERE id = %s
    """, (request_id,))
    
    # Create or update approval record
    cursor.execute("""
        INSERT INTO approvals (request_id, department, signed, signed_by, 
                             signed_at, comments)
        VALUES (%s, %s, 0, %s, NOW(), %s)
        ON DUPLICATE KEY UPDATE 
            signed = 0, signed_by = %s, signed_at = NOW(), comments = %s
    """, (request_id, department, session['user_id'], comment, 
          session['user_id'], comment))
    
    mysql.connection.commit()
    cursor.close()
    
    flash('Request rejected', 'warning')
    return redirect(url_for('view_request', request_id=request_id))

@app.route('/users')
@login_required
@role_required('admin')
def user_management():
    cursor = mysql.connection.cursor()
    cursor.execute("SELECT * FROM users ORDER BY id")
    users = cursor.fetchall()
    cursor.close()
    
    return render_template('user_management.html', users=users)

if __name__ == '__main__':
    app.run(debug=True)