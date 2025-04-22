// Current user session
let currentUser = null;

// DOM elements
const userNameElement = document.getElementById('user-name');
const userRoleElement = document.getElementById('user-role');
const navLinksElement = document.getElementById('nav-links');
const mainContentElement = document.getElementById('main-content');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalFooter = document.getElementById('modal-footer');
const closeModal = document.getElementById('close-modal');
const logoutBtn = document.getElementById('logout-btn');

// Event Listeners
closeModal.addEventListener('click', () => {
    modalContainer.style.display = 'none';
});

logoutBtn.addEventListener('click', () => {
    logout();
});

// Helper Functions
function showModal(title, bodyContent, footerButtons) {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyContent;
    modalFooter.innerHTML = '';
    
    footerButtons.forEach(button => {
        const btn = document.createElement('button');
        btn.textContent = button.text;
        btn.className = button.class || '';
        btn.addEventListener('click', button.action);
        modalFooter.appendChild(btn);
    });
    
    modalContainer.style.display = 'flex';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
    });
}

// Authentication Functions
function login(username, password) {
    const user = DB.users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        updateUserInfo();
        updateNavigation();
        loadDashboard();
        return true;
    }
    
    return false;
}

function logout() {
    currentUser = null;
    loadLoginForm();
}

function updateUserInfo() {
    if (currentUser) {
        userNameElement.textContent = currentUser.name;
        userRoleElement.textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
        
        if (currentUser.department) {
            userRoleElement.textContent += ` (${currentUser.department})`;
        }
    }
}

function updateNavigation() {
    navLinksElement.innerHTML = '';
    
    // Common links for all users
    addNavLink('Dashboard', loadDashboard);
    
    // Role-specific links
    if (currentUser.role === 'requestor') {
        addNavLink('New Request', loadNewRequestForm);
        addNavLink('My Requests', loadMyRequests);
    } else if (currentUser.role === 'approver') {
        addNavLink('Pending Approvals', loadPendingApprovals);
        addNavLink('All Requests', loadAllRequests);
    } else if (currentUser.role === 'admin') {
        addNavLink('All Requests', loadAllRequests);
        addNavLink('User Management', loadUserManagement);
    }
}

function addNavLink(text, clickHandler) {
    const link = document.createElement('a');
    link.textContent = text;
    link.href = '#';
    link.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Remove active class from all links
        document.querySelectorAll('.nav-links a').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add active class to clicked link
        link.classList.add('active');
        
        clickHandler();
    });
    
    navLinksElement.appendChild(link);
}

// View Loaders
function loadLoginForm() {
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Login to Document Request System</h2>
            </div>
            <div>
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter password">
                </div>
                <div id="login-error" style="color: #e74c3c; margin-bottom: 15px; display: none;">
                    Invalid username or password
                </div>
                <button id="login-btn">Login</button>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h3>Demo Accounts</h3>
            </div>
            <div>
                <p>For demonstration purposes, you can use the following accounts:</p>
                <ul>
                    <li><strong>Requestor:</strong> Username: john, Password: pass123</li>
                    <li><strong>Finance Approver:</strong> Username: jane, Password: pass123</li>
                    <li><strong>HR Approver:</strong> Username: mike, Password: pass123</li>
                    <li><strong>IT Approver:</strong> Username: sarah, Password: pass123</li>
                    <li><strong>Operations Approver:</strong> Username: david, Password: pass123</li>
                    <li><strong>Administrator:</strong> Username: admin, Password: admin123</li>
                </ul>
            </div>
        </div>
    `;
    
    document.getElementById('login-btn').addEventListener('click', () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (login(username, password)) {
            document.getElementById('login-error').style.display = 'none';
        } else {
            document.getElementById('login-error').style.display = 'block';
        }
    });
}

function loadDashboard() {
    let content = '';
    
    if (currentUser.role === 'requestor') {
        // Requestor Dashboard
        const myRequests = DB.requests.filter(r => r.createdBy === currentUser.id);
        const draftRequests = myRequests.filter(r => r.status === 'draft').length;
        const pendingRequests = myRequests.filter(r => r.status === 'pending').length;
        const approvedRequests = myRequests.filter(r => r.status === 'approved').length;
        
        content = `
            <div class="card">
                <div class="card-header">
                    <h2>Requestor Dashboard</h2>
                </div>
                <div>
                    <h3>My Request Overview</h3>
                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <div style="background-color: #ecf0f1; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${draftRequests}</div>
                            <div>Draft Requests</div>
                        </div>
                        <div style="background-color: #3498db; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${pendingRequests}</div>
                            <div>Pending Requests</div>
                        </div>
                        <div style="background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${approvedRequests}</div>
                            <div>Approved Requests</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3>Recent Requests</h3>
                        ${getRequestsTableHTML(myRequests.slice(0, 5), true)}
                        
                        <button style="margin-top: 15px;" onclick="loadMyRequests()">View All My Requests</button>
                    </div>
                </div>
            </div>
        `;
    } else if (currentUser.role === 'approver') {
        // Approver Dashboard
        const departmentRequests = DB.requests.filter(r => 
            r.assignedTo === currentUser.department || r.assignedTo === 'All Departments'
        );
        const pendingApprovals = departmentRequests.filter(r => 
            r.status === 'pending' && 
            r.approvals[currentUser.department] && 
            !r.approvals[currentUser.department].signed
        ).length;
        
        content = `
            <div class="card">
                <div class="card-header">
                    <h2>${currentUser.department} Department Dashboard</h2>
                </div>
                <div>
                    <h3>Approval Overview</h3>
                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <div style="background-color: #f39c12; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${pendingApprovals}</div>
                            <div>Pending Approvals</div>
                        </div>
                        <div style="background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${departmentRequests.length - pendingApprovals}</div>
                            <div>Completed Approvals</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3>Department Requests</h3>
                        ${getRequestsTableHTML(departmentRequests.slice(0, 5), true)}
                        
                        <button style="margin-top: 15px;" onclick="loadPendingApprovals()">View Pending Approvals</button>
                    </div>
                </div>
            </div>
        `;
    } else if (currentUser.role === 'admin') {
        // Admin Dashboard
        const pendingRequests = DB.requests.filter(r => r.status === 'pending').length;
        const approvedRequests = DB.requests.filter(r => r.status === 'approved').length;
        
        content = `
            <div class="card">
                <div class="card-header">
                    <h2>Administrator Dashboard</h2>
                </div>
                <div>
                    <h3>System Overview</h3>
                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <div style="background-color: #3498db; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${pendingRequests}</div>
                            <div>Pending Requests</div>
                        </div>
                        <div style="background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${approvedRequests}</div>
                            <div>Approved Requests</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3>Recent Requests</h3>
                        ${getRequestsTableHTML(DB.requests.slice(0, 5), true)}
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button onclick="loadAllRequests()">View All Requests</button>
                            <button onclick="loadUserManagement()">Manage Users</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    mainContentElement.innerHTML = content;
    
    // Add event handlers
    window.loadMyRequests = loadMyRequests;
    window.loadPendingApprovals = loadPendingApprovals;
    window.loadAllRequests = loadAllRequests;
    window.loadUserManagement = loadUserManagement;
}

// Fixed function for initializing the signature pad with precise cursor positioning
function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    const canvasContainer = canvas.parentElement;
    
    // First, fix the canvas dimensions to match its display size
    // This is critical for proper cursor position mapping
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Initialize signature pad with correct options for cursor alignment
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(38, 34, 92)',
        velocityFilterWeight: 0.5,  // Lower for more precise positioning
        minWidth: 0.8,
        maxWidth: 2.0,
        throttle: 0  // No throttling for direct cursor mapping
    });
    
    // Clear button
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });
    
    // Ensure the canvas handles window resize properly
    window.addEventListener('resize', () => {
        // Store the existing signature data
        const data = signaturePad.toData();
        
        // Resize the canvas to match its new display size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Clear and restore the signature data if it existed
        signaturePad.clear();
        if (data && data.length > 0) {
            signaturePad.fromData(data);
        }
    });
    
    return signaturePad;
}

// Fix for the new request form to properly handle initial file uploads
function loadNewRequestForm() {
    // Get current date for min attribute on deadline input
    const today = new Date().toISOString().split('T')[0];
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Create New Request</h2>
            </div>
            <div>
                <div class="form-group">
                    <label for="request-title">Request Title <span class="required">*</span></label>
                    <input type="text" id="request-title" placeholder="Enter request title">
                </div>
                <div class="form-group">
                    <label for="request-description">Description <span class="required">*</span></label>
                    <textarea id="request-description" placeholder="Enter detailed description of your request"></textarea>
                </div>
                <div class="form-group">
                    <label for="request-deadline">Deadline <span class="required">*</span></label>
                    <input type="date" id="request-deadline" min="${today}">
                    <small>Please set a deadline for when this request needs to be processed.</small>
                </div>
                <div class="form-group">
                    <label for="request-urgent">
                        <input type="checkbox" id="request-urgent" style="width: auto; margin-right: 8px;">
                        Mark as Urgent
                    </label>
                    <small>Check this if the request needs immediate attention.</small>
                </div>
                <div class="form-group">
                    <label for="request-files">Initial Documents (Optional)</label>
                    <input type="file" id="request-files" multiple>
                    <small>Upload any supporting documents for your request.</small>
                    <ul class="file-list" id="selected-files-list"></ul>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button id="save-draft-btn">Save as Draft</button>
                    <button id="submit-request-btn" class="success">Submit Request</button>
                </div>
            </div>
        </div>
    `;
    
    // Set up file input event handling
    const fileInput = document.getElementById('request-files');
    const filesList = document.getElementById('selected-files-list');
    
    fileInput.addEventListener('change', () => {
        filesList.innerHTML = '';
        
        if (fileInput.files.length > 0) {
            Array.from(fileInput.files).forEach(file => {
                const listItem = document.createElement('li');
                listItem.className = 'file-item';
                listItem.innerHTML = `
                    <div class="file-name">
                        <span>📄</span>
                        <span>${file.name}</span>
                    </div>
                    <div>Selected for upload</div>
                `;
                filesList.appendChild(listItem);
            });
        }
    });
    
    document.getElementById('save-draft-btn').addEventListener('click', () => {
        saveRequest('draft');
    });
    
    document.getElementById('submit-request-btn').addEventListener('click', () => {
        saveRequest('pending');
    });
}

function loadMyRequests() {
    const myRequests = DB.requests.filter(r => r.createdBy === currentUser.id);
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>My Requests</h2>
                <button id="new-request-btn">New Request</button>
            </div>
            <div class="tabs">
                <div class="tab active" data-status="all">All</div>
                <div class="tab" data-status="draft">Drafts</div>
                <div class="tab" data-status="pending">Pending</div>
                <div class="tab" data-status="approved">Approved</div>
                <div class="tab" data-status="completed">Completed</div>
            </div>
            <div id="requests-table-container">
                ${getRequestsTableHTML(myRequests, true)}
            </div>
        </div>
    `;
    
    // Add event listener for new request button
    document.getElementById('new-request-btn').addEventListener('click', () => {
        loadNewRequestForm();
    });
    
    // Add filter functionality to tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter requests
            const status = tab.dataset.status;
            let filteredRequests = myRequests;
            
            if (status !== 'all') {
                filteredRequests = myRequests.filter(r => r.status === status);
            }
            
            // Update table
            document.getElementById('requests-table-container').innerHTML = 
                getRequestsTableHTML(filteredRequests, true);
        });
    });
}

function loadPendingApprovals() {
    const departmentRequests = DB.requests.filter(r => 
        (r.assignedTo === currentUser.department || r.assignedTo === 'All Departments') && 
        r.status === 'pending'
    );
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Pending Approvals for ${currentUser.department}</h2>
            </div>
            ${departmentRequests.length === 0 ? 
                '<p>No pending approvals for your department.</p>' : 
                getRequestsTableHTML(departmentRequests, true)}
        </div>
    `;
}

function loadAllRequests() {
    let requests = DB.requests;
    
    // For approvers, show only department-related requests
    if (currentUser.role === 'approver') {
        requests = requests.filter(r => r.assignedTo === currentUser.department || r.assignedTo === 'All Departments');
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${currentUser.role === 'approver' ? `${currentUser.department} Department` : 'All'} Requests</h2>
            </div>
            <div class="tabs">
                <div class="tab active" data-status="all">All</div>
                <div class="tab" data-status="draft">Drafts</div>
                <div class="tab" data-status="pending">Pending</div>
                <div class="tab" data-status="approved">Approved</div>
                <div class="tab" data-status="completed">Completed</div>
                <div class="tab" data-status="rejected">Rejected</div>
            </div>
            <div id="requests-table-container">
                ${getRequestsTableHTML(requests, true)}
            </div>
        </div>
    `;
    
    // Add filter functionality to tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Filter requests
            const status = tab.dataset.status;
            let filteredRequests = requests;
            
            if (status !== 'all') {
                filteredRequests = requests.filter(r => r.status === status);
            }
            
            // Update table
            document.getElementById('requests-table-container').innerHTML = 
                getRequestsTableHTML(filteredRequests, true);
        });
    });
}

function loadUserManagement() {
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>User Management</h2>
                <button id="add-user-btn">Add New User</button>
            </div>
            <div>
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Department</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${DB.users.map(user => `
                            <tr>
                                <td>${user.id}</td>
                                <td>${user.name}</td>
                                <td>${user.username}</td>
                                <td>
                                    ${user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                                </td>
                                <td>${user.department || '-'}</td>
                                <td class="actions">
                                    <button class="secondary" onclick="editUser(${user.id})">Edit</button>
                                    <button class="danger" onclick="deleteUser(${user.id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    document.getElementById('add-user-btn').addEventListener('click', () => {
        showAddUserModal();
    });
    
    // Add event handlers
    window.editUser = editUser;
    window.deleteUser = deleteUser;
}

// Fix for the saveRequest function to capture initial files
function saveRequest(status) {
    const title = document.getElementById('request-title').value;
    const description = document.getElementById('request-description').value;
    const deadline = document.getElementById('request-deadline')?.value || '';
    const urgent = document.getElementById('request-urgent')?.checked || false;
    const fileInput = document.getElementById('request-files');
    
    if (!title || !description) {
        alert('Please fill in all required fields');
        return;
    }
    
    const newRequest = {
        id: DB.requests.length + 1,
        title,
        description,
        status,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString().split('T')[0],
        assignedTo: status === 'draft' ? null : 'All Departments', // Now automatically assign to All Departments
        deadline: deadline,
        urgent: urgent,
        approvals: {},
        documents: [],
        initialFiles: []
    };
    
    // Process uploaded files
    if (fileInput && fileInput.files.length > 0) {
        Array.from(fileInput.files).forEach(file => {
            newRequest.initialFiles.push({
                name: file.name,
                uploadedAt: new Date().toISOString().split('T')[0]
            });
        });
    }
    
    // Set up approvals for all departments if not a draft
    if (status !== 'draft') {
        const departments = ['Finance', 'HR', 'IT', 'Operations'];
        departments.forEach(dept => {
            newRequest.approvals[dept] = {
                signed: false,
                signedBy: null,
                signedAt: null,
                comments: null,
                signature: null
            };
        });
    }
    
    DB.requests.push(newRequest);
    
    alert(`Request ${status === 'draft' ? 'saved as draft' : 'submitted'} successfully`);
    loadMyRequests();
}

function editRequestAdmin(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || currentUser.role !== 'admin') {
        alert('Cannot edit this request');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Edit Request (Admin)</h2>
            </div>
            <div>
                <div class="form-group">
                    <label for="admin-edit-title">Request Title</label>
                    <input type="text" id="admin-edit-title" value="${request.title}">
                </div>
                <div class="form-group">
                    <label for="admin-edit-description">Description</label>
                    <textarea id="admin-edit-description">${request.description}</textarea>
                </div>
                <div class="form-group">
                    <label for="admin-edit-status">Status</label>
                    <select id="admin-edit-status">
                        <option value="draft" ${request.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${request.status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="rejected" ${request.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="secondary" onclick="viewRequest(${request.id})">Cancel</button>
                    <button id="admin-update-btn" class="success">Update Request</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('admin-update-btn').addEventListener('click', () => {
        const title = document.getElementById('admin-edit-title').value;
        const description = document.getElementById('admin-edit-description').value;
        const status = document.getElementById('admin-edit-status').value;
        
        if (!title || !description) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Update request
        request.title = title;
        request.description = description;
        request.status = status;
        
        alert('Request updated successfully');
        viewRequest(request.id);
    });
}

function submitRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'draft' || request.createdBy !== currentUser.id) {
        alert('Cannot submit this request');
        return;
    }
    
    // Show confirmation modal with deadline selection
    const today = new Date().toISOString().split('T')[0];
    
    const modalContent = `
        <p>You're about to submit this request for approval.</p>
        
        <div class="form-group">
            <label for="request-deadline">Deadline <span class="required">*</span></label>
            <input type="date" id="request-deadline" min="${today}" value="${request.deadline || ''}">
            <small>Please set a deadline for when this request needs to be processed.</small>
        </div>
        
        <div class="form-group">
            <label for="request-urgent">
                <input type="checkbox" id="request-urgent" style="width: auto; margin-right: 8px;" ${request.urgent ? 'checked' : ''}>
                Mark as Urgent
            </label>
            <small>Check this if the request needs immediate attention.</small>
        </div>
    `;
    
    showModal('Submit Request', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Submit Request',
            class: 'success',
            action: () => {
                const deadline = document.getElementById('request-deadline').value;
                const urgent = document.getElementById('request-urgent').checked;
                
                if (!deadline) {
                    alert('Please specify a deadline');
                    return;
                }
                
                request.status = 'pending';
                request.assignedTo = 'All Departments';
                request.deadline = deadline;
                request.urgent = urgent;
                
                // Set up approvals for all departments
                const departments = ['Finance', 'HR', 'IT', 'Operations'];
                departments.forEach(dept => {
                    request.approvals[dept] = {
                        signed: false,
                        signedBy: null,
                        signedAt: null,
                        comments: null,
                        signature: null
                    };
                });
                
                alert('Request submitted successfully');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

function approveRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    // Allow approvers to sign even if status is already "approved"
    if (!request || 
        (request.status !== 'pending' && request.status !== 'approved') || 
        (request.assignedTo !== currentUser.department && request.assignedTo !== 'All Departments') ||
        !request.approvals[currentUser.department] ||
        request.approvals[currentUser.department].signed) {
        alert('Cannot approve this request');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <label for="approval-comments">Comments (optional)</label>
            <textarea id="approval-comments" placeholder="Enter any comments about this approval"></textarea>
        </div>
        
        <div class="form-group">
            <label for="signature-pad">Signature</label>
            <div class="signature-pad-container">
                <canvas id="signature-pad" width="400" height="200"></canvas>
            </div>
            <div class="signature-pad-controls">
                <button type="button" id="clear-signature" class="secondary">Clear</button>
            </div>
        </div>
    `;
    
    showModal('Approve Request', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Sign & Approve',
            class: 'success',
            action: () => {
                const comments = document.getElementById('approval-comments').value;
                const signatureData = signaturePad.toDataURL();
                
                if (signaturePad.isEmpty()) {
                    alert('Please provide a signature');
                    return;
                }
                
                // Update approval
                request.approvals[currentUser.department] = {
                    signed: true,
                    signedBy: currentUser.id,
                    signedAt: new Date().toISOString().split('T')[0],
                    comments: comments,
                    signature: signatureData
                };
                
                // After department approves with signature,
                // check if all departments have signed
                if (request.assignedTo === 'All Departments') {
                    const allDepartments = ['Finance', 'HR', 'IT', 'Operations'];
                    const allSigned = allDepartments.every(dept => 
                        request.approvals[dept] && request.approvals[dept].signed
                    );
                    
                    if (allSigned) {
                        // All departments have signed, mark as completed
                        request.status = 'completed';
                    } else {
                        // Not all have signed, but this department has
                        request.status = 'approved';
                    }
                } else {
                    // Single department assignment, mark as approved
                    request.status = 'approved';
                }
                
                alert('Request signed successfully');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
    
    // Initialize signature pad
    const canvas = document.getElementById('signature-pad');
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(38, 34, 92)'
    });
    
    // Clear button
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });
}

function rejectRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || 
        (request.status !== 'pending' && request.status !== 'approved') || 
        (request.assignedTo !== currentUser.department && request.assignedTo !== 'All Departments') ||
        !request.approvals[currentUser.department] ||
        request.approvals[currentUser.department].signed) {
        alert('Cannot reject this request');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <label for="rejection-comments">Rejection Reason (required)</label>
            <textarea id="rejection-comments" placeholder="Enter the reason for rejecting this request"></textarea>
        </div>
    `;
    
    showModal('Reject Request', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Reject',
            class: 'danger',
            action: () => {
                const comments = document.getElementById('rejection-comments').value;
                
                if (!comments) {
                    alert('Please provide a reason for rejection');
                    return;
                }
                
                // Update request status
                request.status = 'rejected';
                
                // Update approval
                request.approvals[currentUser.department] = {
                    signed: false,
                    signedBy: currentUser.id,
                    signedAt: new Date().toISOString().split('T')[0],
                    comments: comments,
                    signature: null
                };
                
                alert('Request rejected successfully');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

function uploadDocuments(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Upload Documents for Request #${requestId}</h2>
            </div>
            <div>
                <p>Upload required documents for your request "${request.title}"</p>
                
                <div class="form-group">
                    <label for="upload-files">Select Files <span class="required">*</span></label>
                    <input type="file" id="upload-files" multiple>
                    <small>Please select one or more files to upload</small>
                </div>
                
                <h3>Selected Files</h3>
                <ul class="file-list" id="selected-files-list"></ul>
                
                <h3>Previously Uploaded Documents</h3>
                <ul class="file-list" id="existing-files-list">
                    ${request.documents.map(doc => `
                        <li class="file-item">
                            <div class="file-name">
                                <span>📄</span>
                                <span>${doc.name}</span>
                            </div>
                            <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                        </li>
                    `).join('')}
                </ul>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" id="back-button">Back to Request</button>
                    <button class="success" id="save-documents-btn">Upload Documents</button>
                </div>
            </div>
        </div>
    `;
    
    // Set up file input event handling
    const fileInput = document.getElementById('upload-files');
    const filesList = document.getElementById('selected-files-list');
    
    fileInput.addEventListener('change', () => {
        filesList.innerHTML = '';
        
        if (fileInput.files.length > 0) {
            Array.from(fileInput.files).forEach(file => {
                const listItem = document.createElement('li');
                listItem.className = 'file-item';
                listItem.innerHTML = `
                    <div class="file-name">
                        <span>📄</span>
                        <span>${file.name}</span>
                    </div>
                    <div>Selected for upload</div>
                `;
                filesList.appendChild(listItem);
            });
        }
    });
    
    // Set up back button
    document.getElementById('back-button').addEventListener('click', () => {
        viewRequest(requestId);
    });
    
    // Set up save button
    document.getElementById('save-documents-btn').addEventListener('click', () => {
        const files = fileInput.files;
        
        if (files.length === 0) {
            alert('Please select at least one file to upload');
            return;
        }
        
        // Add files to request
        Array.from(files).forEach(file => {
            request.documents.push({
                name: file.name,
                uploadedAt: new Date().toISOString().split('T')[0]
            });
        });
        
        alert('Documents uploaded successfully');
        viewRequest(requestId);
    });
}

// Admin Functions
function editRequestAdmin(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || currentUser.role !== 'admin') {
        alert('Cannot edit this request');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Edit Request (Admin)</h2>
            </div>
            <div>
                <div class="form-group">
                    <label for="admin-edit-title">Request Title</label>
                    <input type="text" id="admin-edit-title" value="${request.title}">
                </div>
                <div class="form-group">
                    <label for="admin-edit-description">Description</label>
                    <textarea id="admin-edit-description">${request.description}</textarea>
                </div>
                <div class="form-group">
                    <label for="admin-edit-status">Status</label>
                    <select id="admin-edit-status">
                        <option value="draft" ${request.status === 'draft' ? 'selected' : ''}>Draft</option>
                        <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                        <option value="approved" ${request.status === 'approved' ? 'selected' : ''}>Approved</option>
                        <option value="rejected" ${request.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                        <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="secondary" onclick="viewRequest(${request.id})">Cancel</button>
                    <button id="admin-update-btn" class="success">Update Request</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('admin-update-btn').addEventListener('click', () => {
        const title = document.getElementById('admin-edit-title').value;
        const description = document.getElementById('admin-edit-description').value;
        const status = document.getElementById('admin-edit-status').value;
        
        if (!title || !description) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Update request
        request.title = title;
        request.description = description;
        request.status = status;
        
        alert('Request updated successfully');
        viewRequest(request.id);
    });
}

function adminApproveRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'pending' || currentUser.role !== 'admin') {
        alert('Cannot approve this request');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <label for="admin-approval-comments">Admin Comments (optional)</label>
            <textarea id="admin-approval-comments" placeholder="Enter any comments or notes about this approval"></textarea>
        </div>
    `;
    
    showModal('Admin Approval', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Approve Request',
            class: 'success',
            action: () => {
                const comments = document.getElementById('admin-approval-comments').value;
                
                // Admin approval changes status to "approved" but still requires department signatures
                request.status = 'approved';
                request.assignedTo = 'All Departments';
                request.adminApproved = true;
                request.adminApprovedAt = new Date().toISOString().split('T')[0];
                request.adminComments = comments;
                
                alert('Request approved. Departments will now review and sign it.');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

function adminRejectRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'pending' || currentUser.role !== 'admin') {
        alert('Cannot reject this request');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <label for="admin-rejection-comments">Rejection Reason (required)</label>
            <textarea id="admin-rejection-comments" placeholder="Enter the reason for rejecting this request"></textarea>
        </div>
    `;
    
    showModal('Reject Request', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Reject',
            class: 'danger',
            action: () => {
                const comments = document.getElementById('admin-rejection-comments').value;
                
                if (!comments) {
                    alert('Please provide a reason for rejection');
                    return;
                }
                
                // Update request status
                request.status = 'rejected';
                request.adminRejected = true;
                request.adminRejectedAt = new Date().toISOString().split('T')[0];
                request.adminComments = comments;
                
                alert('Request rejected successfully');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

// User Management Functions
function showAddUserModal() {
    const modalContent = `
        <div class="form-group">
            <label for="user-name">Full Name</label>
            <input type="text" id="user-name" placeholder="Enter full name">
        </div>
        <div class="form-group">
            <label for="user-username">Username</label>
            <input type="text" id="user-username" placeholder="Enter username">
        </div>
        <div class="form-group">
            <label for="user-password">Password</label>
            <input type="password" id="user-password" placeholder="Enter password">
        </div>
        <div class="form-group">
            <label for="user-role">Role</label>
            <select id="user-role">
                <option value="requestor">Requestor</option>
                <option value="approver">Department Approver</option>
                <option value="admin">Administrator</option>
            </select>
        </div>
        <div class="form-group" id="department-group" style="display: none;">
            <label for="user-department">Department</label>
            <select id="user-department">
                <option value="Finance">Finance</option>
                <option value="HR">HR</option>
                <option value="IT">IT</option>
                <option value="Operations">Operations</option>
            </select>
        </div>
    `;
    
    showModal('Add New User', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Add User',
            class: 'success',
            action: () => {
                addUser();
            }
        }
    ]);
    
    // Show/hide department based on role
    const roleSelect = document.getElementById('user-role');
    const departmentGroup = document.getElementById('department-group');
    
    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'approver') {
            departmentGroup.style.display = 'block';
        } else {
            departmentGroup.style.display = 'none';
        }
    });
}

function addUser() {
    const name = document.getElementById('user-name').value;
    const username = document.getElementById('user-username').value;
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    let department = null;
    
    if (role === 'approver') {
        department = document.getElementById('user-department').value;
    }
    
    if (!name || !username || !password) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Check if username already exists
    if (DB.users.some(u => u.username === username)) {
        alert('Username already exists');
        return;
    }
    
    const newUser = {
        id: DB.users.length + 1,
        name,
        username,
        password,
        role,
        department
    };
    
    DB.users.push(newUser);
    
    alert('User added successfully');
    modalContainer.style.display = 'none';
    loadUserManagement();
}

function editUser(userId) {
    const user = DB.users.find(u => u.id === userId);
    
    if (!user) {
        alert('User not found');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <label for="edit-user-name">Full Name</label>
            <input type="text" id="edit-user-name" value="${user.name}">
        </div>
        <div class="form-group">
            <label for="edit-user-username">Username</label>
            <input type="text" id="edit-user-username" value="${user.username}">
        </div>
        <div class="form-group">
            <label for="edit-user-role">Role</label>
            <select id="edit-user-role">
                <option value="requestor" ${user.role === 'requestor' ? 'selected' : ''}>Requestor</option>
                <option value="approver" ${user.role === 'approver' ? 'selected' : ''}>Department Approver</option>
                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Administrator</option>
            </select>
        </div>
        <div class="form-group" id="edit-department-group" style="${user.role === 'approver' ? 'display: block;' : 'display: none;'}">
            <label for="edit-user-department">Department</label>
            <select id="edit-user-department">
                <option value="Finance" ${user.department === 'Finance' ? 'selected' : ''}>Finance</option>
                <option value="HR" ${user.department === 'HR' ? 'selected' : ''}>HR</option>
                <option value="IT" ${user.department === 'IT' ? 'selected' : ''}>IT</option>
                <option value="Operations" ${user.department === 'Operations' ? 'selected' : ''}>Operations</option>
            </select>
        </div>
    `;
    
    showModal('Edit User', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Save Changes',
            class: 'success',
            action: () => {
                updateUser(userId);
            }
        }
    ]);
    
    // Show/hide department based on role
    const roleSelect = document.getElementById('edit-user-role');
    const departmentGroup = document.getElementById('edit-department-group');
    
    roleSelect.addEventListener('change', () => {
        if (roleSelect.value === 'approver') {
            departmentGroup.style.display = 'block';
        } else {
            departmentGroup.style.display = 'none';
        }
    });
}

function updateUser(userId) {
    const user = DB.users.find(u => u.id === userId);
    
    if (!user) {
        alert('User not found');
        return;
    }
    
    const name = document.getElementById('edit-user-name').value;
    const username = document.getElementById('edit-user-username').value;
    const role = document.getElementById('edit-user-role').value;
    let department = null;
    
    if (role === 'approver') {
        department = document.getElementById('edit-user-department').value;
    }
    
    if (!name || !username) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Check if username already exists (except for current user)
    if (DB.users.some(u => u.username === username && u.id !== userId)) {
        alert('Username already exists');
        return;
    }
    
    // Update user
    user.name = name;
    user.username = username;
    user.role = role;
    user.department = department;
    
    alert('User updated successfully');
    modalContainer.style.display = 'none';
    loadUserManagement();
}

function deleteUser(userId) {
    const user = DB.users.find(u => u.id === userId);
    
    if (!user) {
        alert('User not found');
        return;
    }
    
    const modalContent = `
        <p>Are you sure you want to delete the user "${user.name}"?</p>
        <p>This action cannot be undone.</p>
    `;
    
    showModal('Confirm Delete', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Delete',
            class: 'danger',
            action: () => {
                // Remove user from database
                const index = DB.users.findIndex(u => u.id === userId);
                DB.users.splice(index, 1);
                
                alert('User deleted successfully');
                modalContainer.style.display = 'none';
                loadUserManagement();
            }
        }
    ]);
}

//Document Management Functions
function viewRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    const requester = DB.users.find(u => u.id === request.createdBy);
    
    let approvalSection = '';
    let documentSection = '';
    let actionButtons = '';
    
    // Approvals section
    if (request.status !== 'draft') {
        const departments = ['Finance', 'HR', 'IT', 'Operations'];
        
        approvalSection = `
            <h3>Department Approvals</h3>
            <div class="department-approval">
                ${departments.map(dept => {
                    const approval = request.approvals[dept];
                    
                    if (!approval) {
                        return `
                            <div class="approval-card">
                                <div><strong>${dept}</strong></div>
                                <div>${request.assignedTo === dept || request.assignedTo === 'All Departments' ? 'Assigned' : 'Not Assigned'}</div>
                            </div>
                        `;
                    }
                    
                    const approver = approval.signed ? DB.users.find(u => u.id === approval.signedBy) : null;
                    
                    return `
                        <div class="approval-card ${approval.signed ? 'signed' : ''}">
                            <div><strong>${dept}</strong></div>
                            <div>${approval.signed ? 'Approved' : 'Pending'}</div>
                            ${approval.signed ? `
                                <div class="sign-info">
                                    Signed by ${approver ? approver.name : 'Unknown'} on ${formatDate(approval.signedAt)}
                                </div>
                                <div class="sign-info">
                                    Comment: ${approval.comments || 'No comment'}
                                </div>
                                ${approval.signature ? `
                                    <div class="signature">
                                        <img src="${approval.signature}" alt="Signature" class="signature-image">
                                    </div>
                                ` : ''}
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Document section with clickable documents
    documentSection = `
        <h3>Initial Files</h3>
        ${request.initialFiles && request.initialFiles.length > 0 ? 
            `<ul class="file-list">
                ${request.initialFiles.map(file => `
                    <li class="file-item">
                        <div class="file-name clickable" onclick="viewDocument(${requestId}, '${file.name}', true)">
                            <span>📄</span>
                            <span>${file.name}</span>
                        </div>
                        <div>Uploaded on ${formatDate(file.uploadedAt)}</div>
                    </li>
                `).join('')}
            </ul>` : 
            '<p>No initial files were uploaded with this request.</p>'
        }
        
        <h3>Uploaded Documents</h3>
        ${request.documents.length === 0 ? 
            '<p>No documents have been uploaded yet.</p>' : 
            `<ul class="file-list">
                ${request.documents.map(doc => `
                    <li class="file-item">
                        <div class="file-name clickable" onclick="viewDocument(${requestId}, '${doc.name}')">
                            <span>📄</span>
                            <span>${doc.name}</span>
                        </div>
                        <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                    </li>
                `).join('')}
            </ul>`
        }
    `;
    
    // Action buttons based on user role and request status
    if (currentUser.role === 'requestor' && request.createdBy === currentUser.id) {
        if (request.status === 'draft') {
            actionButtons = `
                <button class="secondary" id="edit-request-btn">Edit Request</button>
                <button class="success" id="submit-request-btn">Submit Request</button>
                <button class="secondary" id="upload-documents-btn">Upload Documents</button>
            `;
        } else {
            actionButtons = `
                <button class="success" id="upload-documents-btn">Upload Documents</button>
            `;
        }
    } else if (currentUser.role === 'approver' && 
        (request.assignedTo === currentUser.department || request.assignedTo === 'All Departments') && 
        (request.status === 'pending' || request.status === 'approved') &&
        request.approvals[currentUser.department] &&
        !request.approvals[currentUser.department].signed) {
        actionButtons = `
            <button class="success" id="approve-request-btn">Sign</button>
            <button class="danger" id="reject-request-btn">Reject</button>
        `;
    } else if (currentUser.role === 'admin') {
        if (request.status === 'pending') {
            actionButtons = `
                <button class="success" id="admin-approve-btn">Approve Request</button>
                <button class="danger" id="admin-reject-btn">Reject Request</button>
                <button class="secondary" id="admin-edit-btn">Edit Request</button>
                <button class="secondary" id="upload-documents-btn">Upload Documents</button>
            `;
        } else {
            actionButtons = `
                <button class="secondary" id="admin-edit-btn">Edit Request</button>
                <button class="secondary" id="upload-documents-btn">Upload Documents</button>
            `;
        }
    }
    
    // Check for deadline classes
    let deadlineClass = '';
    if (request.deadline) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const deadlineDate = new Date(request.deadline);
        deadlineDate.setHours(0, 0, 0, 0);
        
        const timeDiff = deadlineDate - today;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (daysDiff < 0) {
            deadlineClass = 'urgent-deadline'; // Past deadline
        } else if (daysDiff <= 3) {
            deadlineClass = 'urgent'; // Within 3 days
        }
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${request.title} ${request.urgent ? '<span class="urgent">(Urgent)</span>' : ''}</h2>
                <span class="status ${request.status}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>
            </div>
            <div>
                <div style="margin-bottom: 20px;">
                    <div><strong>Requester:</strong> ${requester ? requester.name : 'Unknown'}</div>
                    <div><strong>Created on:</strong> ${formatDate(request.createdAt)}</div>
                    <div><strong>Deadline:</strong> <span class="${deadlineClass}">${request.deadline ? formatDate(request.deadline) : 'Not specified'}</span></div>
                    <div><strong>Assigned to:</strong> ${request.assignedTo === 'All Departments' ? 'All Departments' : request.assignedTo || 'Not assigned yet'}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3>Description</h3>
                    <p>${request.description}</p>
                </div>
                
                ${approvalSection}
                
                ${documentSection}
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" id="back-button">Back</button>
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
    
    // Add event handler for back button
    document.getElementById('back-button').addEventListener('click', () => {
        if (currentUser.role === 'requestor') {
            loadMyRequests();
        } else if (currentUser.role === 'approver') {
            loadPendingApprovals();
        } else {
            loadAllRequests();
        }
    });
    
    // Add event handlers for action buttons
    if (currentUser.role === 'requestor' && request.createdBy === currentUser.id) {
        if (request.status === 'draft') {
            document.getElementById('edit-request-btn').addEventListener('click', () => {
                editRequest(request.id);
            });
            document.getElementById('submit-request-btn').addEventListener('click', () => {
                submitRequest(request.id);
            });
        }
        
        // Always add the upload documents button functionality for requestors
        document.getElementById('upload-documents-btn').addEventListener('click', () => {
            uploadDocuments(request.id);
        });
    } else if (currentUser.role === 'approver' && 
        (request.assignedTo === currentUser.department || request.assignedTo === 'All Departments') && 
        (request.status === 'pending' || request.status === 'approved') &&
        request.approvals[currentUser.department] &&
        !request.approvals[currentUser.department].signed) {
        document.getElementById('approve-request-btn').addEventListener('click', () => {
            approveRequest(request.id);
        });
        document.getElementById('reject-request-btn').addEventListener('click', () => {
            rejectRequest(request.id);
        });
    } else if (currentUser.role === 'admin') {
        document.getElementById('admin-edit-btn').addEventListener('click', () => {
            editRequestAdmin(request.id);
        });
        
        document.getElementById('upload-documents-btn').addEventListener('click', () => {
            uploadDocuments(request.id);
        });
        
        if (request.status === 'pending') {
            document.getElementById('admin-approve-btn').addEventListener('click', () => {
                adminApproveRequest(request.id);
            });
            document.getElementById('admin-reject-btn').addEventListener('click', () => {
                adminRejectRequest(request.id);
            });
        }
    }
    
    // Make viewDocument function available globally
    window.viewDocument = viewDocument;
}

function viewDocument(requestId, docName, isInitialFile = false) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    // Find the document
    const doc = isInitialFile 
        ? request.initialFiles.find(d => d.name === docName)
        : request.documents.find(d => d.name === docName);
    
    if (!doc) {
        alert('Document not found');
        return;
    }
    
    // Get file extension for icon and preview type
    const fileExt = docName.split('.').pop().toLowerCase();
    
    // Determine file type and appropriate preview
    let previewHTML = '';
    let fileType = '';
    
    switch (fileExt) {
        case 'pdf':
            fileType = 'PDF Document';
            previewHTML = `
                <div class="document-preview pdf-preview">
                    <div class="preview-header">
                        <div style="text-align: right; color: #999; font-size: 12px;">1 of 3</div>
                    </div>
                    <div class="preview-content">
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px;">${docName.replace('.pdf', '')}</div>
                            <div style="color: #666; font-style: italic; margin-bottom: 40px;">Document preview for ${docName}</div>
                            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                                This is a simulated preview of the PDF content.
                                In a real application, this would show the actual PDF content.
                            </div>
                            <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666;">
                                Page 1 - Document ID: REQ-${requestId}-DOC-${new Date(doc.uploadedAt).getTime()}
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'docx':
        case 'doc':
            fileType = 'Word Document';
            previewHTML = `
                <div class="document-preview word-preview">
                    <div class="preview-content">
                        <div style="padding: 20px; border: 1px solid #ddd; border-radius: 4px;">
                            <div style="font-size: 22px; font-weight: bold; margin-bottom: 20px; color: #2b579a;">${docName.replace(/\.(docx|doc)$/, '')}</div>
                            <div style="margin-bottom: 15px;">
                                <p style="margin-bottom: 10px;">This is a simulated preview of the Word document content.</p>
                                <p style="margin-bottom: 10px;">Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam eget felis eget nunc lobortis mattis aliquam faucibus.</p>
                                <p>In a real application, this would show the actual document content.</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'xlsx':
        case 'xls':
            fileType = 'Excel Spreadsheet';
            previewHTML = `
                <div class="document-preview excel-preview">
                    <div class="preview-content">
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #e2efd9;">
                                    <th style="border: 1px solid #ccc; padding: 8px;">Item</th>
                                    <th style="border: 1px solid #ccc; padding: 8px;">Quantity</th>
                                    <th style="border: 1px solid #ccc; padding: 8px;">Price</th>
                                    <th style="border: 1px solid #ccc; padding: 8px;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 8px;">Item 1</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">5</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$10.00</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$50.00</td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 8px;">Item 2</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">3</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$15.00</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$45.00</td>
                                </tr>
                                <tr>
                                    <td style="border: 1px solid #ccc; padding: 8px;">Item 3</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">2</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$20.00</td>
                                    <td style="border: 1px solid #ccc; padding: 8px;">$40.00</td>
                                </tr>
                            </tbody>
                            <tfoot>
                                <tr style="background-color: #e2efd9;">
                                    <td colspan="3" style="border: 1px solid #ccc; padding: 8px; text-align: right;"><strong>Total:</strong></td>
                                    <td style="border: 1px solid #ccc; padding: 8px;"><strong>$135.00</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                        <div style="margin-top: 15px; color: #666; font-size: 12px; text-align: center;">
                            Simulated preview of ${docName} - Sheet 1
                        </div>
                    </div>
                </div>
            `;
            break;
        case 'jpg':
        case 'jpeg':
        case 'png':
            fileType = 'Image';
            previewHTML = `
                <div class="document-preview image-preview">
                    <div style="text-align: center; padding: 20px;">
                        <div style="background-color: #f5f5f5; border-radius: 4px; padding: 40px; margin-bottom: 15px;">
                            <div style="font-size: 14px; color: #666;">
                                [Simulated image preview for ${docName}]
                            </div>
                            <div style="height: 200px; display: flex; align-items: center; justify-content: center; margin: 20px 0;">
                                <svg width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="#26225C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </div>
                            <div style="font-size: 14px; color: #666;">
                                Image dimensions: 1920 x 1080
                            </div>
                        </div>
                    </div>
                </div>
            `;
            break;
        default:
            fileType = 'Document';
            previewHTML = `
                <div class="document-preview">
                    <div style="text-align: center; padding: 40px;">
                        <div style="margin-bottom: 20px;">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#26225C" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                        </div>
                        <div style="font-size: 16px; margin-bottom: 10px;">${docName}</div>
                        <div style="color: #666; margin-bottom: 20px;">
                            Preview not available for this file type
                        </div>
                        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px; display: inline-block;">
                            Document uploaded on ${formatDate(doc.uploadedAt)}
                        </div>
                    </div>
                </div>
            `;
    }
    
    // Create modal content
    const modalContent = `
        <div class="document-viewer">
            <div class="document-info">
                <div class="info-item">
                    <strong>File Name:</strong> ${docName}
                </div>
                <div class="info-item">
                    <strong>File Type:</strong> ${fileType}
                </div>
                <div class="info-item">
                    <strong>Uploaded:</strong> ${formatDate(doc.uploadedAt)}
                </div>
                <div class="info-item">
                    <strong>Related Request:</strong> #${requestId} - ${request.title}
                </div>
                <div class="info-item">
                    <strong>Uploaded By:</strong> ${
                        DB.users.find(u => u.id === request.createdBy)?.name || 'Unknown'
                    }
                </div>
            </div>
            
            <div class="document-content">
                ${previewHTML}
            </div>
        </div>
    `;
    
    // Show the modal
    showModal(`View Document: ${docName}`, modalContent, [
        {
            text: 'Close',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Download (Simulated)',
            class: 'success',
            action: () => {
                alert(`Download started for ${docName} (This is a simulation - no actual download happens)`);
            }
        }
    ]);
}

// Helper Functions
function getRequestsTableHTML(requests, withActions = false) {
    if (requests.length === 0) {
        return '<p>No requests found.</p>';
    }
    
    // Sort requests by deadline (nearest first)
    const sortedRequests = [...requests].sort((a, b) => {
        // If no deadline, put at the end
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        
        // Sort by date (ascending)
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    // Get current date for deadline comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Date</th>
                    <th>Deadline</th>
                    <th>Assigned To</th>
                    ${withActions ? '<th>Actions</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${sortedRequests.map(request => {
                    const requester = DB.users.find(u => u.id === request.createdBy);
                    
                    // Check if deadline is approaching (within 3 days or past)
                    let deadlineClass = '';
                    if (request.deadline) {
                        const deadlineDate = new Date(request.deadline);
                        deadlineDate.setHours(0, 0, 0, 0);
                        
                        const timeDiff = deadlineDate - today;
                        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
                        
                        if (daysDiff < 0) {
                            deadlineClass = 'urgent-deadline'; // Past deadline
                        } else if (daysDiff <= 3) {
                            deadlineClass = 'urgent'; // Within 3 days
                        }
                    }
                    
                    return `
                        <tr>
                            <td>${request.id}</td>
                            <td>${request.title} ${request.urgent ? '<span class="urgent">(Urgent)</span>' : ''}</td>
                            <td>
                                <span class="status ${request.status}">
                                    ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                                </span>
                            </td>
                            <td>${requester ? requester.name : 'Unknown'}</td>
                            <td>${formatDate(request.createdAt)}</td>
                            <td class="${deadlineClass}">${request.deadline ? formatDate(request.deadline) : '-'}</td>
                            <td>${request.assignedTo === 'All Departments' ? 'All Departments' : request.assignedTo || '-'}</td>
                            ${withActions ? 
                                `<td class="actions">
                                    <button onclick="viewRequest(${request.id})">View</button>
                                </td>` : 
                                ''
                            }
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

function addDocumentViewerStyles() {
    // This function will be called to add styles for document viewer
    if (document.getElementById('document-viewer-styles')) {
        return; // Already added
    }
    
    const style = document.createElement('style');
    style.id = 'document-viewer-styles';
    style.textContent = `
        .document-viewer {
            padding: 20px;
        }
        
        .document-info {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
        }
        
        .info-item {
            margin-bottom: 10px;
        }
        
        .document-content {
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .document-preview {
            background-color: white;
            padding: 20px;
        }
        
        .preview-header {
            padding: 10px;
            background-color: #f5f5f5;
            border-bottom: 1px solid #ddd;
        }
        
        .pdf-preview, .word-preview, .excel-preview, .image-preview {
            min-height: 400px;
        }
    `;
    
    document.head.appendChild(style);
}

function initializeSignaturePad() {
    const canvas = document.getElementById('signature-pad');
    const canvasContainer = canvas.parentElement;
    
    // First, fix the canvas dimensions to match its display size
    // This is critical for proper cursor position mapping
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Initialize signature pad with correct options for cursor alignment
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(38, 34, 92)',
        velocityFilterWeight: 0.5,  // Lower for more precise positioning
        minWidth: 0.8,
        maxWidth: 2.0,
        throttle: 0  // No throttling for direct cursor mapping
    });
    
    // Clear button
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
    });
    
    // Ensure the canvas handles window resize properly
    window.addEventListener('resize', () => {
        // Store the existing signature data
        const data = signaturePad.toData();
        
        // Resize the canvas to match its new display size
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        
        // Clear and restore the signature data if it existed
        signaturePad.clear();
        if (data && data.length > 0) {
            signaturePad.fromData(data);
        }
    });
    
    return signaturePad;
}

// Initialize application
function init() {
    // Make sure all functions are in the global scope
    window.viewRequest = viewRequest;
    window.editRequest = editRequest;
    window.submitRequest = submitRequest;
    window.uploadDocuments = uploadDocuments;
    window.approveRequest = approveRequest;
    window.rejectRequest = rejectRequest;
    window.editRequestAdmin = editRequestAdmin;
    window.adminApproveRequest = adminApproveRequest;
    window.adminRejectRequest = adminRejectRequest;
    window.loadMyRequests = loadMyRequests;
    window.loadPendingApprovals = loadPendingApprovals;
    window.loadAllRequests = loadAllRequests;
    window.loadUserManagement = loadUserManagement;
    window.loadNewRequestForm = loadNewRequestForm;
    window.viewDocument = viewDocument;
    
    // Add document viewer styles
    addDocumentViewerStyles();
    
    // Check if user is logged in
    if (!currentUser) {
        loadLoginForm();
    } else {
        updateUserInfo();
        updateNavigation();
        loadDashboard();
    }
}

// Call init when document is ready
document.addEventListener('DOMContentLoaded', function() {
    init();
});