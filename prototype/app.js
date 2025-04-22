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
    
    // All roles can now create new requests
    addNavLink('New Request', loadNewRequestForm);
    
    // Role-specific links
    if (currentUser.role === 'requestor') {
        addNavLink('My Requests', loadMyRequests);
    } else if (currentUser.role === 'approver') {
        addNavLink('My Requests', loadMyRequests);
        addNavLink('Pending Approvals', loadPendingApprovals);
        addNavLink('All Requests', loadAllRequests);
    } else if (currentUser.role === 'admin') {
        addNavLink('My Requests', loadMyRequests);
        addNavLink('All Requests', loadAllRequests);
        addNavLink('Assign Requests', loadAssignRequests);
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
    
    // Get all requests by current user regardless of role
    const myRequests = DB.requests.filter(r => r.createdBy === currentUser.id);
    const draftRequests = myRequests.filter(r => r.status === 'draft').length;
    const pendingRequests = myRequests.filter(r => ['pending', 'in review', 'waiting for approval', 'on hold'].includes(r.status)).length;
    const approvedRequests = myRequests.filter(r => r.status === 'approved').length;
    const completedRequests = myRequests.filter(r => r.status === 'completed').length;
    
    // Common dashboard for all users showing their requests
    content = `
        <div class="card">
            <div class="card-header">
                <h2>${currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)} Dashboard</h2>
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
                    <div style="background-color: #9b59b6; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                        <div style="font-size: 24px; font-weight: bold;">${completedRequests}</div>
                        <div>Completed Requests</div>
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
    
    // Add role-specific sections to the dashboard
    if (currentUser.role === 'approver') {
        const departmentRequests = DB.requests.filter(r => r.assignedTo === currentUser.department);
        const waitingApprovals = departmentRequests.filter(r => 
            r.status === 'waiting for approval' && 
            r.approvals[currentUser.department] && 
            !r.approvals[currentUser.department].signed
        ).length;
        
        content += `
            <div class="card">
                <div class="card-header">
                    <h2>${currentUser.department} Department Dashboard</h2>
                </div>
                <div>
                    <h3>Approval Overview</h3>
                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <div style="background-color: #f39c12; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${waitingApprovals}</div>
                            <div>Waiting For Approval</div>
                        </div>
                        <div style="background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${departmentRequests.length - waitingApprovals}</div>
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
        const unassignedRequests = DB.requests.filter(r => !r.assignedTo && r.status !== 'draft').length;
        const pendingRequests = DB.requests.filter(r => ['pending', 'in review', 'waiting for approval', 'on hold'].includes(r.status)).length;
        const approvedRequests = DB.requests.filter(r => r.status === 'approved').length;
        const completedRequests = DB.requests.filter(r => r.status === 'completed').length;
        
        content += `
            <div class="card">
                <div class="card-header">
                    <h2>Administrator Dashboard</h2>
                </div>
                <div>
                    <h3>System Overview</h3>
                    <div style="display: flex; gap: 20px; margin-top: 20px; flex-wrap: wrap;">
                        <div style="background-color: #e74c3c; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${unassignedRequests}</div>
                            <div>Unassigned Requests</div>
                        </div>
                        <div style="background-color: #3498db; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${pendingRequests}</div>
                            <div>Pending Requests</div>
                        </div>
                        <div style="background-color: #2ecc71; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${approvedRequests}</div>
                            <div>Approved Requests</div>
                        </div>
                        <div style="background-color: #9b59b6; color: white; padding: 20px; border-radius: 8px; min-width: 150px;">
                            <div style="font-size: 24px; font-weight: bold;">${completedRequests}</div>
                            <div>Completed Requests</div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3>Recent Requests</h3>
                        ${getRequestsTableHTML(DB.requests.slice(0, 5), true)}
                        
                        <div style="display: flex; gap: 10px; margin-top: 15px;">
                            <button onclick="loadAllRequests()">View All Requests</button>
                            <button onclick="loadAssignRequests()">Assign Requests</button>
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
    window.loadAssignRequests = loadAssignRequests;
    window.loadUserManagement = loadUserManagement;
}

// Update new request form with mandatory deadline
function loadNewRequestForm() {
    mainContentElement.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>Create New Request</h2>
        </div>
        <div>
          <div class="form-group">
            <label for="request-title">Request Title <span style="color: #e74c3c;">*</span></label>
            <input type="text" id="request-title" placeholder="Enter request title">
          </div>
          <div class="form-group">
            <label for="request-description">Description <span style="color: #e74c3c;">*</span></label>
            <textarea id="request-description" placeholder="Enter detailed description"></textarea>
          </div>
          <div class="form-group">
            <label for="request-deadline">Deadline <span style="color: #e74c3c;">*</span></label>
            <input type="date" id="request-deadline">
          </div>
          <div class="form-group">
            <label for="request-urgent">Priority</label>
            <select id="request-urgent">
              <option value="false">Normal</option>
              <option value="true">Urgent</option>
            </select>
          </div>
          <div class="form-group">
            <label for="initial-files">Supporting Documents</label>
            <div class="dropzone" id="initial-file-dropzone">
              <p>Drag & drop files here or click to select files</p>
              <input type="file" id="initial-file-input" style="display: none;" multiple>
            </div>
            <ul class="file-list" id="initial-file-list"></ul>
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="save-draft-btn">Save as Draft</button>
            <button id="submit-request-btn" class="success">Submit Request</button>
          </div>
        </div>
      </div>
    `;
    
    // Setup file dropzone
    const dropzone = document.getElementById('initial-file-dropzone');
    const fileInput = document.getElementById('initial-file-input');
    const fileList = document.getElementById('initial-file-list');
    const uploadedFiles = [];
    
    // Dropzone click to select files
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change event
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Dropzone drag and drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#3498db';
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#3498db';
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#3498db';
        handleFiles(e.dataTransfer.files);
    });
    
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            uploadedFiles.push(file);
            
            const listItem = document.createElement('li');
            listItem.className = 'file-item';
            listItem.innerHTML = `
                <div class="file-name">
                    <span>📄</span>
                    <span>${file.name}</span>
                </div>
                <div>Selected for upload</div>
                <button class="remove-file danger" data-filename="${file.name}">Remove</button>
            `;
            
            fileList.appendChild(listItem);
        });
        
        // Add remove file functionality
        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                const index = uploadedFiles.findIndex(f => f.name === filename);
                if (index !== -1) {
                    uploadedFiles.splice(index, 1);
                    e.target.closest('.file-item').remove();
                }
            });
        });
    }
  
    document.getElementById('save-draft-btn').addEventListener('click', () => saveRequest('draft'));
    document.getElementById('submit-request-btn').addEventListener('click', () => saveRequest('pending'));
    
    function saveRequest(status) {
        const title = document.getElementById('request-title').value;
        const description = document.getElementById('request-description').value;
        const deadline = document.getElementById('request-deadline').value;
        const urgent = document.getElementById('request-urgent').value === 'true';
        
        if (!title || !description || !deadline) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Ensure deadline is in the future
        const today = new Date().toISOString().split('T')[0];
        if (deadline < today) {
            alert('Deadline must be a future date');
            return;
        }
        
        const initialFiles = uploadedFiles.map(file => ({
            name: file.name,
            uploadedAt: new Date().toISOString().split('T')[0]
        }));
        
        const newRequest = {
            id: DB.requests.length + 1,
            title,
            description,
            status,
            createdBy: currentUser.id,
            createdAt: new Date().toISOString().split('T')[0],
            deadline,
            urgent,
            assignedTo: status === 'draft' ? null : null, // Will be assigned by admin
            approvals: {},
            documents: [],
            initialFiles
        };
        
        DB.requests.push(newRequest);
        
        alert(`Request ${status === 'draft' ? 'saved as draft' : 'submitted'} successfully`);
        loadMyRequests();
    }
}

function loadMyRequests() {
    const myRequests = DB.requests.filter(r => r.createdBy === currentUser.id);
    
    // Sort requests by deadline (soonest first)
    myRequests.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>My Requests</h2>
                <button onclick="loadNewRequestForm()">New Request</button>
            </div>
            <div class="tabs">
                <div class="tab active" data-status="all">All</div>
                <div class="tab" data-status="draft">Drafts</div>
                <div class="tab" data-status="pending">Pending</div>
                <div class="tab" data-status="in review,waiting for approval,on hold">In Review</div>
                <div class="tab" data-status="approved">Approved</div>
                <div class="tab" data-status="rejected">Rejected</div>
                <div class="tab" data-status="completed">Completed</div>
            </div>
            <div id="requests-table-container">
                ${getRequestsTableHTML(myRequests, true)}
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
            let filteredRequests = myRequests;
            
            if (status !== 'all') {
                const statusArray = status.split(',');
                filteredRequests = myRequests.filter(r => statusArray.includes(r.status));
            }
            
            // Update table
            document.getElementById('requests-table-container').innerHTML = 
                getRequestsTableHTML(filteredRequests, true);
        });
    });
    
    // Add event handler for loadNewRequestForm
    window.loadNewRequestForm = loadNewRequestForm;
}

function loadPendingApprovals() {
    const departmentRequests = DB.requests.filter(r => 
        r.assignedTo === currentUser.department && 
        (r.status === 'pending' || r.status === 'waiting for approval')
    );
    
    // Sort by deadline (soonest first)
    departmentRequests.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    // Sort urgent requests first
    departmentRequests.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
    });
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Pending Approvals for ${currentUser.department}</h2>
            </div>
            <div class="tabs">
                <div class="tab active" data-status="all">All</div>
                <div class="tab" data-status="pending">Pending</div>
                <div class="tab" data-status="waiting for approval">Waiting For Approval</div>
                <div class="tab" data-status="on hold">On Hold</div>
            </div>
            <div id="requests-table-container">
                ${departmentRequests.length === 0 ? 
                    '<p>No pending approvals for your department.</p>' : 
                    getRequestsTableHTML(departmentRequests, true)}
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
            let filteredRequests = departmentRequests;
            
            if (status !== 'all') {
                filteredRequests = departmentRequests.filter(r => r.status === status);
            }
            
            // Update table
            document.getElementById('requests-table-container').innerHTML = 
                filteredRequests.length === 0 ? 
                '<p>No matching requests found.</p>' : 
                getRequestsTableHTML(filteredRequests, true);
        });
    });
}

function loadAllRequests() {
    let requests = DB.requests;
    
    // For approvers, show only department-related requests
    if (currentUser.role === 'approver') {
        requests = requests.filter(r => r.assignedTo === currentUser.department);
    }
    
    // Sort by deadline (soonest first)
    requests.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    // Sort urgent requests first
    requests.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
    });
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${currentUser.role === 'approver' ? `${currentUser.department} Department` : 'All'} Requests</h2>
            </div>
            <div class="tabs">
                <div class="tab active" data-status="all">All</div>
                <div class="tab" data-status="draft">Drafts</div>
                <div class="tab" data-status="pending">Pending</div>
                <div class="tab" data-status="in review,waiting for approval">In Review</div>
                <div class="tab" data-status="on hold">On Hold</div>
                <div class="tab" data-status="approved">Approved</div>
                <div class="tab" data-status="rejected">Rejected</div>
                <div class="tab" data-status="completed">Completed</div>
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
                const statusArray = status.split(',');
                filteredRequests = requests.filter(r => statusArray.includes(r.status));
            }
            
            // Update table
            document.getElementById('requests-table-container').innerHTML = 
                filteredRequests.length === 0 ? 
                '<p>No matching requests found.</p>' : 
                getRequestsTableHTML(filteredRequests, true);
        });
    });
}

function loadAssignRequests() {
    const unassignedRequests = DB.requests.filter(r => !r.assignedTo && r.status !== 'draft');
    
    // Sort by deadline (soonest first)
    unassignedRequests.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
    });
    
    // Sort urgent requests first
    unassignedRequests.sort((a, b) => {
        if (a.urgent && !b.urgent) return -1;
        if (!a.urgent && b.urgent) return 1;
        return 0;
    });
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Assign Requests</h2>
            </div>
            <div>
                <h3>Unassigned Requests</h3>
                ${unassignedRequests.length === 0 ? 
                    '<p>No unassigned requests.</p>' : 
                    getRequestsTableHTML(unassignedRequests, true)}
            </div>
            
            <div style="margin-top: 30px;">
                <h3>All Requests</h3>
                ${getRequestsTableHTML(DB.requests, true)}
            </div>
        </div>
    `;
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

function viewRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    const requester = DB.users.find(u => u.id === request.createdBy);
    
    let approvalSection = '';
    let documentSection = '';
    let initialFileSection = '';
    let actionButtons = '';
    
    // Initial files section
    if (request.initialFiles && request.initialFiles.length > 0) {
        initialFileSection = `
            <h3>Supporting Documents</h3>
            <ul class="file-list">
                ${request.initialFiles.map(doc => `
                    <li class="file-item">
                        <div class="file-name">
                            <span>📄</span>
                            <span>${doc.name}</span>
                        </div>
                        <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                    </li>
                `).join('')}
            </ul>
        `;
    }
    
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
                                <div>${request.assignedTo === dept ? 'Assigned' : 'Not Assigned'}</div>
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
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Enhanced Documents section with signature status
    if (request.documents && request.documents.length > 0) {
        documentSection = `
            <h3>Uploaded Documents</h3>
            <ul class="file-list">
                ${request.documents.map(doc => {
                    const signatureStatus = doc.signed ? 
                        `<span class="status approved">Signed</span>` : 
                        `<span class="status pending">Unsigned</span>`;
                    
                    const signer = doc.signedBy ? DB.users.find(u => u.id === doc.signedBy) : null;
                    const signInfo = doc.signed ? 
                        `<div class="sign-info">Signed by ${signer ? signer.name : 'Unknown'} on ${formatDate(doc.signedAt)}</div>` : 
                        '';
                    
                    return `
                        <li class="file-item">
                            <div class="file-name">
                                <span>📄</span>
                                <span>${doc.name}</span>
                            </div>
                            <div>
                                <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                                ${signInfo}
                            </div>
                            <div>${signatureStatus}</div>
                        </li>
                    `;
                }).join('')}
            </ul>
            ${(currentUser.role === 'approver' || currentUser.role === 'admin') && request.status === 'approved' ? 
                `<button class="secondary" onclick="viewDocumentSignatures(${request.id})">Manage Document Signatures</button>` : 
                ''
            }
        `;
    } else {
        documentSection = `
            <h3>Uploaded Documents</h3>
            <p>No documents have been uploaded yet.</p>
        `;
    }
    
    // Action buttons based on user role and request status
    if (currentUser.role === 'requestor' && request.createdBy === currentUser.id) {
        if (request.status === 'draft') {
            actionButtons = `
                <button class="secondary" onclick="editRequest(${request.id})">Edit Request</button>
                <button class="success" onclick="submitRequest(${request.id})">Submit Request</button>
            `;
        } else if (request.status === 'on hold') {
            actionButtons = `
                <button class="success" onclick="uploadSupportingDocuments(${request.id})">Upload Supporting Documents</button>
            `;
        } else if (request.status === 'approved') {
            actionButtons = `
                <button class="success" onclick="markCompleted(${request.id})">Mark as Completed</button>
                <button class="secondary" onclick="uploadDocuments(${request.id})">Upload Documents</button>
            `;
        }
    } else if (currentUser.role === 'approver') {
        if (request.assignedTo === currentUser.department) {
            if (request.status === 'pending') {
                actionButtons = `
                    <button class="success" onclick="changeStatus(${request.id}, 'waiting for approval')">Start Review</button>
                `;
            } else if (request.status === 'waiting for approval') {
                actionButtons = `
                    <button class="success" onclick="approveRequest(${request.id})">Approve</button>
                    <button class="secondary" onclick="requestAdditionalInfo(${request.id})">Request Info</button>
                    <button class="danger" onclick="rejectRequest(${request.id})">Reject</button>
                `;
            } else if (request.status === 'approved' && request.documents.length > 0) {
                actionButtons = `
                    <button class="success" onclick="viewDocumentSignatures(${request.id})">Sign Documents</button>
                `;
            }
        }
    } else if (currentUser.role === 'admin') {
        if (!request.assignedTo && request.status !== 'draft') {
            actionButtons = `
                <button class="success" onclick="assignRequest(${request.id})">Assign to Department</button>
            `;
        }
        
        if (request.status === 'approved' || request.status === 'completed') {
            actionButtons += `
                <button class="secondary" onclick="changeStatus(${request.id}, 'completed')">Mark as Completed</button>
            `;
        }
        
        actionButtons += `
            <button class="secondary" onclick="editRequestAdmin(${request.id})">Edit Request</button>
        `;
    }
    
    // Status badge style & urgency badge
    let statusBadge = `<span class="status ${request.status.replace(/\s+/g, '-')}">${request.status.charAt(0).toUpperCase() + request.status.slice(1)}</span>`;
    let urgencyBadge = request.urgent ? `<span class="urgency urgent">Urgent</span>` : `<span class="urgency normal">Normal</span>`;
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>${request.title}</h2>
                <div style="display: flex; gap: 10px;">
                    ${statusBadge}
                    ${urgencyBadge}
                </div>
            </div>
            <div>
                <div style="margin-bottom: 20px;">
                    <div><strong>Requester:</strong> ${requester ? requester.name : 'Unknown'}</div>
                    <div><strong>Created on:</strong> ${formatDate(request.createdAt)}</div>
                    <div><strong>Deadline:</strong> <span class="${isPastDue(request.deadline) ? 'past-due' : ''}">${formatDate(request.deadline) || 'Not specified'}</span></div>
                    <div><strong>Assigned Department:</strong> ${request.assignedTo || 'Not assigned yet'}</div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3>Description</h3>
                    <p>${request.description}</p>
                </div>
                
                ${initialFileSection}
                
                ${approvalSection}
                
                ${documentSection}
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" onclick="goBack()">Back</button>
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
    
    // Add event handlers
    window.goBack = () => {
        if (currentUser.role === 'requestor') {
            loadMyRequests();
        } else if (currentUser.role === 'approver') {
            loadPendingApprovals();
        } else {
            loadAllRequests();
        }
    };
    
    window.editRequest = editRequest;
    window.submitRequest = submitRequest;
    window.uploadDocuments = uploadDocuments;
    window.uploadSupportingDocuments = uploadSupportingDocuments;
    window.approveRequest = approveRequest;
    window.rejectRequest = rejectRequest;
    window.requestAdditionalInfo = requestAdditionalInfo;
    window.assignRequest = assignRequest;
    window.editRequestAdmin = editRequestAdmin;
    window.markCompleted = markCompleted;
    window.changeStatus = changeStatus;
    window.viewDocumentSignatures = viewDocumentSignatures;
    window.signDocument = signDocument;
    window.revokeSignature = revokeSignature;
}


function isPastDue(deadline) {
    if (!deadline) return false;
    const today = new Date();
    const dueDate = new Date(deadline);
    return today > dueDate;
}

function changeStatus(requestId, newStatus) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    const modalContent = `
        <p>Are you sure you want to change the status of this request to "${newStatus}"?</p>
    `;
    
    showModal('Change Status', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Change Status',
            class: 'success',
            action: () => {
                request.status = newStatus;
                alert('Status updated successfully');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

function markCompleted(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'approved') {
        alert('Cannot mark as completed');
        return;
    }
    
    const modalContent = `
        <p>Are you sure you want to mark this request as completed?</p>
        <p>This action will finalize the request process.</p>
    `;
    
    showModal('Mark as Completed', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Complete',
            class: 'success',
            action: () => {
                request.status = 'completed';
                alert('Request marked as completed');
                modalContainer.style.display = 'none';
                viewRequest(request.id);
            }
        }
    ]);
}

function editRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'draft' || request.createdBy !== currentUser.id) {
        alert('Cannot edit this request');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Edit Request</h2>
            </div>
            <div>
                <div class="form-group">
                    <label for="edit-request-title">Request Title <span style="color: #e74c3c;">*</span></label>
                    <input type="text" id="edit-request-title" value="${request.title}">
                </div>
                <div class="form-group">
                    <label for="edit-request-description">Description <span style="color: #e74c3c;">*</span></label>
                    <textarea id="edit-request-description">${request.description}</textarea>
                </div>
                <div class="form-group">
                    <label for="edit-request-deadline">Deadline <span style="color: #e74c3c;">*</span></label>
                    <input type="date" id="edit-request-deadline" value="${request.deadline || ''}">
                </div>
                <div class="form-group">
                    <label for="edit-request-urgent">Priority</label>
                    <select id="edit-request-urgent">
                        <option value="false" ${!request.urgent ? 'selected' : ''}>Normal</option>
                        <option value="true" ${request.urgent ? 'selected' : ''}>Urgent</option>
                    </select>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button class="secondary" onclick="viewRequest(${request.id})">Cancel</button>
                    <button id="update-draft-btn" class="success">Update Draft</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('update-draft-btn').addEventListener('click', () => {
        const title = document.getElementById('edit-request-title').value;
        const description = document.getElementById('edit-request-description').value;
        const deadline = document.getElementById('edit-request-deadline').value;
        const urgent = document.getElementById('edit-request-urgent').value === 'true';
        
        if (!title || !description || !deadline) {
            alert('Please fill in all required fields');
            return;
        }
        
        // Ensure deadline is in the future
        const today = new Date().toISOString().split('T')[0];
        if (deadline < today) {
            alert('Deadline must be a future date');
            return;
        }
        
        request.title = title;
        request.description = description;
        request.deadline = deadline;
        request.urgent = urgent;
        
        alert('Draft updated successfully');
        viewRequest(request.id);
    });
}

function submitRequest(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'draft' || request.createdBy !== currentUser.id) {
        alert('Cannot submit this request');
        return;
    }
    
    // Check if deadline is set
    if (!request.deadline) {
        alert('Please edit the request and set a deadline before submitting');
        return;
    }
    
    request.status = 'pending';
    
    alert('Request submitted successfully');
    viewRequest(request.id);
}

// Update uploadSupportingDocuments function for the "on hold" status
function uploadSupportingDocuments(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request || request.status !== 'on hold') {
        alert('Cannot upload supporting documents for this request');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Upload Additional Information for ${request.title}</h2>
            </div>
            <div>
                <p>Please upload the additional documents requested by the department:</p>
                
                <div class="dropzone" id="upload-dropzone">
                    <p>Drag & drop files here or click to select files</p>
                    <input type="file" id="file-input" style="display: none;" multiple>
                </div>
                
                <div id="upload-preview-container" style="margin-top: 20px; display: none;">
                    <h3>Files Ready for Upload</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Document Name</th>
                                <th>Type</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="upload-preview-list">
                            <!-- Selected files will appear here -->
                        </tbody>
                    </table>
                </div>
                
                <h3>Current Supporting Documents</h3>
                <ul class="file-list" id="file-list">
                    ${request.initialFiles ? request.initialFiles.map(doc => `
                        <li class="file-item">
                            <div class="file-name">
                                <span>📄</span>
                                <span>${doc.name}</span>
                            </div>
                            <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                        </li>
                    `).join('') : ''}
                </ul>
                
                <div class="form-group">
                    <label for="request-response">Response to the Department (required)</label>
                    <textarea id="request-response" placeholder="Provide context for the additional information you're uploading"></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" onclick="viewRequest(${request.id})">Back to Request</button>
                    <button id="submit-info-btn" class="success">Submit Information</button>
                </div>
            </div>
        </div>
    `;
    
    const dropzone = document.getElementById('upload-dropzone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const uploadPreviewContainer = document.getElementById('upload-preview-container');
    const uploadPreviewList = document.getElementById('upload-preview-list');
    const uploadedFiles = [];
    
    // Dropzone click to select files
    dropzone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change event
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
    
    // Dropzone drag and drop events
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#3498db';
    });
    
    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#3498db';
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#3498db';
        handleFiles(e.dataTransfer.files);
    });
    
    function handleFiles(files) {
        Array.from(files).forEach(file => {
            // Check if file already selected
            if (uploadedFiles.some(f => f.name === file.name)) {
                alert(`File "${file.name}" is already selected.`);
                return;
            }
            
            // Add file to uploadedFiles array
            uploadedFiles.push({
                file: file,
                name: file.name
            });
            
            // Show the preview container
            uploadPreviewContainer.style.display = 'block';
            
            // Add file to the preview list
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${file.name}</td>
                <td>${getFileType(file.name)}</td>
                <td>
                    <button class="remove-file danger" data-filename="${file.name}">Remove</button>
                </td>
            `;
            
            uploadPreviewList.appendChild(row);
        });
        // Add remove file functionality
        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                const index = uploadedFiles.findIndex(f => f.name === filename);
                if (index !== -1) {
                    uploadedFiles.splice(index, 1);
                    e.target.closest('tr').remove();
                    
                    // Hide preview container if no files remain
                    if (uploadedFiles.length === 0) {
                        uploadPreviewContainer.style.display = 'none';
                    }
                }
            });
        });
    }
        // Add event listeners to signature selectors
        document.querySelectorAll('.requires-signature').forEach(select => {
            select.addEventListener('change', (e) => {
                const filename = e.target.dataset.filename;
                const requiresSignature = e.target.value === 'true';
                
                const fileIndex = uploadedFiles.findIndex(f => f.name === filename);
                if (fileIndex !== -1) {
                    uploadedFiles[fileIndex].requiresSignature = requiresSignature;
                }
            });
        });
        
        // Add remove file functionality
        document.querySelectorAll('.remove-file').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filename = e.target.dataset.filename;
                const index = uploadedFiles.findIndex(f => f.name === filename);
                if (index !== -1) {
                    uploadedFiles.splice(index, 1);
                    e.target.closest('tr').remove();
                    
                    // Hide preview container if no files remain
                    if (uploadedFiles.length === 0) {
                        uploadPreviewContainer.style.display = 'none';
                    }
                }
            });
        });
    }
    
    // Helper function to get file type based on extension
    function getFileType(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        switch (extension) {
            case 'pdf':
                return 'PDF Document';
            case 'doc':
            case 'docx':
                return 'Word Document';
            case 'xls':
            case 'xlsx':
                return 'Excel Spreadsheet';
            case 'ppt':
            case 'pptx':
                return 'PowerPoint Presentation';
            case 'txt':
                return 'Text Document';
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                return 'Image';
            default:
                return 'Unknown';
        }
    }
    
    // Submit information button
    document.getElementById('submit-info-btn').addEventListener('click', () => {
        const response = document.getElementById('request-response').value;
        
        if (!response) {
            alert('Please provide a response to the department');
            return;
        }
        
        if (uploadedFiles.length === 0) {
            alert('Please upload at least one file');
            return;
        }
        
        // Add files to request documents
        uploadedFiles.forEach(fileData => {
            if (!request.initialFiles) {
                request.initialFiles = [];
            }
            
            request.initialFiles.push({
                name: fileData.name,
                uploadedAt: new Date().toISOString().split('T')[0]
            });
        });
        
        // Add response to request and change status back to waiting for approval
        request.status = 'waiting for approval';
        
        // Store the response
        if (!request.additionalInfoResponses) {
            request.additionalInfoResponses = [];
        }
        
        request.additionalInfoResponses.push({
            response: response,
            respondedAt: new Date().toISOString().split('T')[0],
            respondedBy: currentUser.id
        });
        
        alert('Additional information submitted successfully');
        viewRequest(request.id);
    });

// Make functions available globally
window.approveRequest = approveRequest;
window.loadPendingApprovals = loadPendingApprovals;
window.requestAdditionalInfo = requestAdditionalInfo;
window.uploadSupportingDocuments = uploadSupportingDocuments;

    // Save uploads button
    document.getElementById('save-uploads-btn').addEventListener('click', () => {
        if (uploadedFiles.length === 0) {
            alert('Please select at least one file to upload');
            return;
        }
        
        // Add files to request documents
        uploadedFiles.forEach(fileData => {
            request.documents.push({
                name: fileData.name,
                uploadedAt: new Date().toISOString().split('T')[0],
                requiresSignature: fileData.requiresSignature,
                signed: false,
                signedBy: null,
                signedAt: null,
                signatureComments: null
            });
        });
        
        alert('Documents uploaded successfully');
        viewRequest(request.id);
    });

// Replace the signDocument function with this updated version that properly saves the signature

function signDocument(requestId, documentName) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    // Verify user is an approver and is assigned to this department
    if (currentUser.role !== 'approver' && currentUser.role !== 'admin') {
        alert('Only approvers and administrators can sign documents');
        return;
    }
    
    if (currentUser.role === 'approver' && request.assignedTo !== currentUser.department) {
        alert('You can only sign documents for requests assigned to your department');
        return;
    }
    
    // Find the document in the request
    const documentIndex = request.documents.findIndex(doc => doc.name === documentName);
    if (documentIndex === -1) {
        alert('Document not found');
        return;
    }
    
    // Check if document is already signed
    if (request.documents[documentIndex].signed) {
        alert('This document has already been signed');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Sign Document: ${documentName}</h2>
            </div>
            <div>
                <p>Please draw your signature in the box below:</p>
                
                <div class="signature-pad-container">
                    <canvas id="signature-pad" class="signature-pad" width="600" height="200"></canvas>
                    <div class="signature-pad-actions">
                        <button id="clear-signature" class="secondary">Clear</button>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="signature-comments">Comments (optional)</label>
                    <textarea id="signature-comments" placeholder="Enter any comments about this signature"></textarea>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="signature-confirmation"> 
                        I confirm that this is my signature and I approve this document
                    </label>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" onclick="viewDocumentSignatures(${request.id})">Cancel</button>
                    <button id="submit-signature-btn" class="success" disabled>Sign Document</button>
                </div>
            </div>
        </div>
    `;
    
    // Initialize signature pad
    const canvas = document.getElementById('signature-pad');
    const signaturePad = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        penColor: 'rgb(0, 0, 0)'
    });
    
    // Adjust canvas to container size
    function resizeCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear(); // Otherwise isEmpty() might return incorrect value
    }
    
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();
    
    // Clear button
    document.getElementById('clear-signature').addEventListener('click', () => {
        signaturePad.clear();
        validateForm();
    });
    
    // Confirmation checkbox
    const confirmationCheckbox = document.getElementById('signature-confirmation');
    confirmationCheckbox.addEventListener('change', validateForm);
    
    // Validate form before enabling submit button
    function validateForm() {
        const submitButton = document.getElementById('submit-signature-btn');
        submitButton.disabled = signaturePad.isEmpty() || !confirmationCheckbox.checked;
    }
    
    // Add listener to submit button
    document.getElementById('submit-signature-btn').addEventListener('click', () => {
        if (signaturePad.isEmpty()) {
            alert('Please provide a signature');
            return;
        }
        
        if (!confirmationCheckbox.checked) {
            alert('Please confirm your signature');
            return;
        }
        
        const comments = document.getElementById('signature-comments').value;
        const signatureDataUrl = signaturePad.toDataURL();
        
        // Update document with signature information
        request.documents[documentIndex].signed = true;
        request.documents[documentIndex].signedBy = currentUser.id;
        request.documents[documentIndex].signedAt = new Date().toISOString().split('T')[0];
        request.documents[documentIndex].signatureComments = comments;
        request.documents[documentIndex].signatureImage = signatureDataUrl;
        
        // Add to signature logs for audit trail
        if (!DB.signatureLogs) {
            DB.signatureLogs = [];
        }
        
        DB.signatureLogs.push({
            id: DB.signatureLogs.length + 1,
            requestId: request.id,
            documentName: documentName,
            action: 'signed',
            userId: currentUser.id,
            timestamp: new Date().toISOString(),
            comments: comments
        });
        
        alert('Document signed successfully');
        viewDocumentSignatures(request.id);
    });
    
    // Make sure the validateForm function is called initially
    validateForm();
}

// Global function to ensure it's accessible
window.signDocument = signDocument;

// Updated viewDocumentSignatures function to show signature images
function viewDocumentSignatures(requestId) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    // Filter documents that need signatures or are signed
    const documents = request.documents;
    
    if (documents.length === 0) {
        alert('No documents available for this request');
        return;
    }
    
    mainContentElement.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>Document Signatures for ${request.title}</h2>
            </div>
            <div>
                <p>The following documents are part of this request and may require signatures.</p>
                
                <div class="document-list">
                    ${documents.map(doc => {
                        const signer = doc.signedBy ? DB.users.find(u => u.id === doc.signedBy) : null;
                        const signatureStatus = doc.signed ? 
                            'Signed' : 
                            doc.requiresSignature ? 'Signature Required' : 'No Signature Required';
                        const statusClass = doc.signed ? 
                            'approved' : 
                            doc.requiresSignature ? 'pending' : '';
                        
                        return `
                            <div class="document-item ${doc.signed ? 'signed' : doc.requiresSignature ? 'requires-signature' : ''}">
                                <div class="document-info">
                                    <div class="document-name">
                                        <span>📄</span>
                                        <span>${doc.name}</span>
                                    </div>
                                    <div class="document-meta">
                                        <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                                        <div>
                                            <span class="status ${statusClass}">${signatureStatus}</span>
                                        </div>
                                    </div>
                                    
                                    ${doc.signed ? `
                                        <div class="signature-info">
                                            <div class="signer">Signed by ${signer ? signer.name : 'Unknown'}</div>
                                            <div class="date">Date: ${formatDate(doc.signedAt)}</div>
                                            ${doc.signatureComments ? `<div class="comments">Comment: ${doc.signatureComments}</div>` : ''}
                                            
                                            ${doc.signatureImage ? `
                                                <div class="signature-image-container">
                                                    <h4>Signature:</h4>
                                                    <img src="${doc.signatureImage}" alt="Digital Signature" class="signature-image" />
                                                </div>
                                            ` : ''}
                                        </div>
                                    ` : ''}
                                </div>
                                
                                <div class="document-actions">
                                    ${!doc.signed && doc.requiresSignature && (currentUser.role === 'approver' || currentUser.role === 'admin') ? 
                                        `<button onclick="signDocument(${request.id}, '${doc.name}')">Sign</button>` : 
                                        ''
                                    }
                                    ${doc.signed && currentUser.role === 'admin' ? 
                                        `<button class="danger" onclick="revokeSignature(${request.id}, '${doc.name}')">Revoke</button>` : 
                                        ''
                                    }
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button class="secondary" onclick="viewRequest(${request.id})">Back to Request</button>
                </div>
            </div>
        </div>
    `;
}



// Function to revoke a signature (admin only)
function revokeSignature(requestId, documentName) {
    const request = DB.requests.find(r => r.id === requestId);
    
    if (!request) {
        alert('Request not found');
        return;
    }
    
    // Verify user is an admin
    if (currentUser.role !== 'admin') {
        alert('Only administrators can revoke signatures');
        return;
    }
    
    // Find the document in the request
    const documentIndex = request.documents.findIndex(doc => doc.name === documentName);
    if (documentIndex === -1) {
        alert('Document not found');
        return;
    }
    
    // Check if document is signed
    if (!request.documents[documentIndex].signed) {
        alert('This document has not been signed');
        return;
    }
    
    const modalContent = `
        <div class="form-group">
            <p>You are about to revoke the signature for document: <strong>${documentName}</strong></p>
            <p>This action will remove the current signature and cannot be undone.</p>
        </div>
        <div class="form-group">
            <label for="revoke-reason">Reason for Revocation (required)</label>
            <textarea id="revoke-reason" placeholder="Enter the reason for revoking this signature"></textarea>
        </div>
    `;
    
    showModal('Revoke Signature', modalContent, [
        {
            text: 'Cancel',
            class: 'secondary',
            action: () => {
                modalContainer.style.display = 'none';
            }
        },
        {
            text: 'Revoke Signature',
            class: 'danger',
            action: () => {
                const reason = document.getElementById('revoke-reason').value;
                
                if (!reason) {
                    alert('Please provide a reason for revoking the signature');
                    return;
                }
                
                // Update document to remove signature information
                request.documents[documentIndex].signed = false;
                request.documents[documentIndex].revokedBy = currentUser.id;
                request.documents[documentIndex].revokedAt = new Date().toISOString().split('T')[0];
                request.documents[documentIndex].revocationReason = reason;
                
                // Keep track of previous signature info for audit purposes
                request.documents[documentIndex].previousSignature = {
                    signedBy: request.documents[documentIndex].signedBy,
                    signedAt: request.documents[documentIndex].signedAt,
                    signatureComments: request.documents[documentIndex].signatureComments
                };
                
                // Clear current signature info
                request.documents[documentIndex].signedBy = null;
                request.documents[documentIndex].signedAt = null;
                request.documents[documentIndex].signatureComments = null;
                
                alert('Signature revoked successfully');
                modalContainer.style.display = 'none';
                viewDocumentSignatures(request.id);
            }
        }
    ]);
}

function rejectRequest(requestId) {
const request = DB.requests.find(r => r.id === requestId);

if (!request || 
request.status !== 'waiting for approval' || 
request.assignedTo !== currentUser.department) {
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
        if (!request.approvals[currentUser.department]) {
            request.approvals[currentUser.department] = {
                signed: false,
                signedBy: currentUser.id,
                signedAt: new Date().toISOString().split('T')[0],
                comments: comments
            };
        } else {
            request.approvals[currentUser.department].comments = comments;
        }
        
        alert('Request rejected successfully');
        modalContainer.style.display = 'none';
        viewRequest(request.id);
    }
}
]);
}

function assignRequest(requestId) {
const request = DB.requests.find(r => r.id === requestId);

if (!request || request.status === 'draft' || currentUser.role !== 'admin') {
alert('Cannot assign this request');
return;
}

const modalContent = `
<div class="form-group">
    <label for="assign-department">Assign to Department</label>
    <select id="assign-department">
        <option value="">Select Department</option>
        <option value="Finance">Finance</option>
        <option value="HR">HR</option>
        <option value="IT">IT</option>
        <option value="Operations">Operations</option>
    </select>
</div>
`;

showModal('Assign Request', modalContent, [
{
    text: 'Cancel',
    class: 'secondary',
    action: () => {
        modalContainer.style.display = 'none';
    }
},
{
    text: 'Assign',
    class: 'success',
    action: () => {
        const department = document.getElementById('assign-department').value;
        
        if (!department) {
            alert('Please select a department');
            return;
        }
        
        // Update request
        request.assignedTo = department;
        
        // Update status to "in review" when assigned
        if (request.status === 'pending') {
            request.status = 'in review';
        }
        
        // Initialize approvals for this department
        request.approvals[department] = {
            signed: false,
            signedBy: null,
            signedAt: null,
            comments: null
        };
        
        alert(`Request assigned to ${department} successfully`);
        modalContainer.style.display = 'none';
        viewRequest(request.id);
    }
}
]);
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
            <label for="admin-edit-deadline">Deadline</label>
            <input type="date" id="admin-edit-deadline" value="${request.deadline || ''}">
        </div>
        <div class="form-group">
            <label for="admin-edit-urgent">Priority</label>
            <select id="admin-edit-urgent">
                <option value="false" ${!request.urgent ? 'selected' : ''}>Normal</option>
                <option value="true" ${request.urgent ? 'selected' : ''}>Urgent</option>
            </select>
        </div>
        <div class="form-group">
            <label for="admin-edit-status">Status</label>
            <select id="admin-edit-status">
                <option value="draft" ${request.status === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                <option value="in review" ${request.status === 'in review' ? 'selected' : ''}>In Review</option>
                <option value="waiting for approval" ${request.status === 'waiting for approval' ? 'selected' : ''}>Waiting for Approval</option>
                <option value="on hold" ${request.status === 'on hold' ? 'selected' : ''}>On Hold</option>
                <option value="approved" ${request.status === 'approved' ? 'selected' : ''}>Approved</option>
                <option value="rejected" ${request.status === 'rejected' ? 'selected' : ''}>Rejected</option>
                <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
            </select>
        </div>
        <div class="form-group">
            <label for="admin-edit-department">Assigned Department</label>
            <select id="admin-edit-department">
                <option value="">Not Assigned</option>
                <option value="Finance" ${request.assignedTo === 'Finance' ? 'selected' : ''}>Finance</option>
                <option value="HR" ${request.assignedTo === 'HR' ? 'selected' : ''}>HR</option>
                <option value="IT" ${request.assignedTo === 'IT' ? 'selected' : ''}>IT</option>
                <option value="Operations" ${request.assignedTo === 'Operations' ? 'selected' : ''}>Operations</option>
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
const deadline = document.getElementById('admin-edit-deadline').value;
const urgent = document.getElementById('admin-edit-urgent').value === 'true';
const status = document.getElementById('admin-edit-status').value;
const department = document.getElementById('admin-edit-department').value;

if (!title || !description || !deadline) {
    alert('Please fill in all required fields');
    return;
}

// Update request
request.title = title;
request.description = description;
request.deadline = deadline;
request.urgent = urgent;
request.status = status;

// If department is changing or being assigned
if (department !== request.assignedTo) {
    // If department is being removed
    if (!department) {
        request.assignedTo = null;
    } else {
        request.assignedTo = department;
        
        // Add approval if not exists
        if (!request.approvals[department]) {
            request.approvals[department] = {
                signed: false,
                signedBy: null,
                signedAt: null,
                comments: null
            };
        }
    }
}

alert('Request updated successfully');
viewRequest(request.id);
});
}

// Helper Functions
function getRequestsTableHTML(requests, withActions = false) {
if (requests.length === 0) {
return '<p>No requests found.</p>';
}

return `
<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Created By</th>
            <th>Created</th>
            <th>Deadline</th>
            <th>Priority</th>
            <th>Assigned To</th>
            ${withActions ? '<th>Actions</th>' : ''}
        </tr>
    </thead>
    <tbody>
        ${requests.map(request => {
            const requester = DB.users.find(u => u.id === request.createdBy);
            const isPastDeadline = isPastDue(request.deadline);
            
            return `
                <tr>
                    <td>${request.id}</td>
                    <td>${request.title}</td>
                    <td>
                        <span class="status ${request.status.replace(/\s+/g, '-')}">
                            ${request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                    </td>
                    <td>${requester ? requester.name : 'Unknown'}</td>
                    <td>${formatDate(request.createdAt)}</td>
                    <td class="${isPastDeadline ? 'past-due' : ''}">${request.deadline ? formatDate(request.deadline) : '-'}</td>
                    <td>
                        <span class="urgency ${request.urgent ? 'urgent' : 'normal'}">
                            ${request.urgent ? 'Urgent' : 'Normal'}
                        </span>
                    </td>
                    <td>${request.assignedTo || '-'}</td>
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

// Initialize application
function init() {
// Check if user is logged in
if (!currentUser) {
loadLoginForm();
} else {
updateUserInfo();
updateNavigation();
loadDashboard();
}

// Add event handler for viewRequest
window.viewRequest = viewRequest;
}

// Start the application
init();