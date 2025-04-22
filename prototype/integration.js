// Document signing and management fixes
(function() {
    // Function to upload primary documents
    window.uploadPrimaryDocuments = function(requestId) {
        const request = DB.requests.find(r => r.id === requestId);
        
        if (!request) {
            alert('Request not found');
            return;
        }
        
        if (!request.documents) {
            request.documents = [];
        }
        
        mainContentElement.innerHTML = `
            <div class="card">
                <div class="card-header">
                    <h2>Upload Primary Documents for ${request.title}</h2>
                </div>
                <div>
                    <p>Please upload official documents that require signatures.</p>
                    
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
                                    <th>Requires Signature</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody id="upload-preview-list">
                                <!-- Selected files will appear here -->
                            </tbody>
                        </table>
                    </div>
                    
                    <div style="margin-top: 30px;">
                        <h3>Currently Uploaded Documents</h3>
                        ${request.documents.length === 0 ? 
                            '<p>No documents have been uploaded yet.</p>' : 
                            `<ul class="file-list">
                                ${request.documents.map(doc => `
                                    <li class="file-item">
                                        <div class="file-name">
                                            <span>📄</span>
                                            <span>${doc.name}</span>
                                        </div>
                                        <div>
                                            <div>Uploaded on ${formatDate(doc.uploadedAt)}</div>
                                            <div>${doc.requiresSignature ? 'Requires signature' : 'No signature required'}</div>
                                        </div>
                                        <div>
                                            <span class="status ${doc.signed ? 'approved' : 'pending'}">
                                                ${doc.signed ? 'Signed' : 'Unsigned'}
                                            </span>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>`
                        }
                    </div>
                    
                    <div style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="secondary" onclick="viewRequest(${request.id})">Back to Request</button>
                        <button id="save-uploads-btn" class="success" disabled>Save Documents</button>
                    </div>
                </div>
            </div>
        `;
        
        const dropzone = document.getElementById('upload-dropzone');
        const fileInput = document.getElementById('file-input');
        const uploadPreviewContainer = document.getElementById('upload-preview-container');
        const uploadPreviewList = document.getElementById('upload-preview-list');
        const saveUploadsBtn = document.getElementById('save-uploads-btn');
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
                    name: file.name,
                    requiresSignature: true  // DEFAULT TO REQUIRING SIGNATURE
                });
                
                // Show the preview container
                uploadPreviewContainer.style.display = 'block';
                
                // Add file to the preview list
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${file.name}</td>
                    <td>${getFileType(file.name)}</td>
                    <td>
                        <select class="requires-signature" data-filename="${file.name}">
                            <option value="true" selected>Yes</option>
                            <option value="false">No</option>
                        </select>
                    </td>
                    <td>
                        <button class="remove-file danger" data-filename="${file.name}">Remove</button>
                    </td>
                `;
                
                uploadPreviewList.appendChild(row);
            });
            
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
                            saveUploadsBtn.disabled = true;
                        }
                    }
                });
            });
            
            // Enable save button if files are uploaded
            saveUploadsBtn.disabled = uploadedFiles.length === 0;
        }
        
        // Helper function to get file type based on extension
        function getFileType(filename) {
            const extension = filename.split('.').pop().toLowerCase();
            switch (extension) {
                case 'pdf': return 'PDF Document';
                case 'doc': case 'docx': return 'Word Document';
                case 'xls': case 'xlsx': return 'Excel Spreadsheet';
                case 'ppt': case 'pptx': return 'PowerPoint Presentation';
                case 'txt': return 'Text Document';
                case 'jpg': case 'jpeg': case 'png': case 'gif': return 'Image';
                default: return 'Unknown';
            }
        }
        
        // Save uploads button
        saveUploadsBtn.addEventListener('click', () => {
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
    };

    // Override viewRequest to remove supporting documents section and add buttons for approvers
    const originalViewRequest = window.viewRequest;
    window.viewRequest = function(requestId) {
        // Call the original function first
        originalViewRequest(requestId);
        
        setTimeout(() => {
            const request = DB.requests.find(r => r.id === requestId);
            if (!request) return;
            
            // Find and remove any supporting documents section
            const headers = document.querySelectorAll('.card h3');
            headers.forEach(header => {
                if (header.textContent === 'Supporting Documents') {
                    const parentDiv = header.parentElement;
                    // Remove the header
                    parentDiv.removeChild(header);
                    
                    // Find and remove the file list if it exists
                    const fileList = parentDiv.querySelector('.file-list');
                    if (fileList) {
                        parentDiv.removeChild(fileList);
                    }
                }
            });
            
            // Get the button container
            const actionBtnsContainer = document.querySelector('.card > div:last-child > div[style*="display: flex; gap: 10px"]');
            if (!actionBtnsContainer) return;
            
            // Add buttons for approvers
            if ((currentUser.role === 'approver' && request.assignedTo === currentUser.department) || 
                currentUser.role === 'admin') {
                
                // Add Upload Primary Documents button if not already there
                const hasUploadBtn = Array.from(actionBtnsContainer.children).some(btn => 
                    btn.textContent === 'Upload Primary Documents');
                
                if (!hasUploadBtn) {
                    const uploadBtn = document.createElement('button');
                    uploadBtn.className = 'secondary';
                    uploadBtn.textContent = 'Upload Primary Documents';
                    uploadBtn.onclick = () => uploadPrimaryDocuments(requestId);
                    actionBtnsContainer.appendChild(uploadBtn);
                }
                
                // Add Sign Documents button if documents exist and not already there
                if (request.documents && request.documents.length > 0) {
                    const hasSignBtn = Array.from(actionBtnsContainer.children).some(btn => 
                        btn.textContent === 'Sign Documents');
                    
                    if (!hasSignBtn) {
                        const signBtn = document.createElement('button');
                        signBtn.className = 'success';
                        signBtn.textContent = 'Sign Documents';
                        signBtn.onclick = () => viewDocumentSignatures(requestId);
                        actionBtnsContainer.appendChild(signBtn);
                    }
                }
            }
        }, 200);
    };

    // Update viewDocumentSignatures to show sign buttons for all users with appropriate roles
    window.viewDocumentSignatures = function(requestId) {
        const request = DB.requests.find(r => r.id === requestId);
        
        if (!request) {
            alert('Request not found');
            return;
        }
        
        // Filter documents that need signatures or are signed
        const documents = request.documents || [];
        
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
                            
                            // Simplified condition - allow signing if not signed and requires signature
                            const canSign = !doc.signed && doc.requiresSignature && 
                                          (currentUser.role === 'approver' || currentUser.role === 'admin');
                            
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
                                        ${canSign ? 
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
    };

    // Update the signDocument function
    window.signDocument = function(requestId, documentName) {
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
    };

    // Function to revoke a signature (admin only)
    window.revokeSignature = function(requestId, documentName) {
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
                    const previousSignature = {
                        signedBy: request.documents[documentIndex].signedBy,
                        signedAt: request.documents[documentIndex].signedAt,
                        signatureComments: request.documents[documentIndex].signatureComments
                    };
                    
                    request.documents[documentIndex].signed = false;
                    request.documents[documentIndex].revokedBy = currentUser.id;
                    request.documents[documentIndex].revokedAt = new Date().toISOString().split('T')[0];
                    request.documents[documentIndex].revocationReason = reason;
                    request.documents[documentIndex].previousSignature = previousSignature;
                    
                    // Clear current signature info
                    request.documents[documentIndex].signedBy = null;
                    request.documents[documentIndex].signedAt = null;
                    request.documents[documentIndex].signatureComments = null;
                    
                    // Add to signature logs for audit trail
                    if (!DB.signatureLogs) {
                        DB.signatureLogs = [];
                    }
                    
                    DB.signatureLogs.push({
                        id: DB.signatureLogs.length + 1,
                        requestId: request.id,
                        documentName: documentName,
                        action: 'revoked',
                        userId: currentUser.id,
                        timestamp: new Date().toISOString(),
                        comments: reason
                    });
                    
                    alert('Signature revoked successfully');
                    modalContainer.style.display = 'none';
                    viewDocumentSignatures(request.id);
                }
            }
        ]);
    };

    // Update the approve request function to set the status correctly
    window.approveRequest = function(requestId) {
        const request = DB.requests.find(r => r.id === requestId);
        
        if (!request) {
            alert('Request not found');
            return;
        }
        
        const modalContent = `
            <div class="form-group">
                <label for="approval-comments">Approval Comments (optional)</label>
                <textarea id="approval-comments" placeholder="Enter any comments about this approval"></textarea>
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
                text: 'Approve',
                class: 'success',
                action: () => {
                    const comments = document.getElementById('approval-comments').value;
                    
                    // Update approval status for this department
                    if (!request.approvals[currentUser.department]) {
                        request.approvals[currentUser.department] = {};
                    }
                    
                    request.approvals[currentUser.department].signed = true;
                    request.approvals[currentUser.department].signedBy = currentUser.id;
                    request.approvals[currentUser.department].signedAt = new Date().toISOString().split('T')[0];
                    request.approvals[currentUser.department].comments = comments;
                    
                    // Update request status to approved
                    request.status = 'approved';
                    
                    alert('Request approved successfully');
                    modalContainer.style.display = 'none';
                    viewRequest(request.id);
                }
            }
        ]);
    };

    // Add function to request additional documents
    window.requestAdditionalInfo = function(requestId) {
        const request = DB.requests.find(r => r.id === requestId);
        
        if (!request) {
            alert('Request not found');
            return;
        }
        
        const modalContent = `
            <div class="form-group">
                <label for="additional-info-request">Information Required</label>
                <textarea id="additional-info-request" placeholder="Please describe what additional information or documents are needed"></textarea>
            </div>
        `;
        
        showModal('Request Additional Information', modalContent, [
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
                    const additionalInfoRequest = document.getElementById('additional-info-request').value;
                    
                    if (!additionalInfoRequest) {
                        alert('Please describe what additional information is needed');
                        return;
                    }
                    
                    // Update request status to on hold
                    request.status = 'on hold';
                    
                    // Add request for additional info
                    if (!request.additionalInfoRequests) {
                        request.additionalInfoRequests = [];
                    }
                    
                    request.additionalInfoRequests.push({
                        requestedBy: currentUser.id,
                        requestedAt: new Date().toISOString().split('T')[0],
                        request: additionalInfoRequest,
                        responded: false
                    });
                    
                    alert('Request for additional information sent successfully');
                    modalContainer.style.display = 'none';
                    viewRequest(request.id);
                }
            }
        ]);
    };

    // Enhanced version of uploadSupportingDocuments function
    window.uploadSupportingDocuments = function(requestId) {
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
        
        // Helper function to get file type based on extension
        function getFileType(filename) {
            const extension = filename.split('.').pop().toLowerCase();
            switch (extension) {
                case 'pdf': return 'PDF Document';
                case 'doc': case 'docx': return 'Word Document';
                case 'xls': case 'xlsx': return 'Excel Spreadsheet';
                case 'ppt': case 'pptx': return 'PowerPoint Presentation';
                case 'txt': return 'Text Document';
                case 'jpg': case 'jpeg': case 'png': case 'gif': return 'Image';
                default: return 'Unknown';
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
    };
    
    // Add Sign Documents button to all view buttons
    const addSignButtonsToViews = function() {
        setTimeout(() => {
            const viewButtons = document.querySelectorAll('button[onclick^="viewRequest"]');
            viewButtons.forEach(button => {
                const originalOnClick = button.onclick;
                button.onclick = function(e) {
                    if (originalOnClick) originalOnClick.call(this, e);
                    
                    // Adding a delay to ensure DOM is updated
                    setTimeout(() => {
                        if (currentUser.role === 'approver' || currentUser.role === 'admin') {
                            const requestIdMatch = button.getAttribute('onclick').match(/viewRequest\((\d+)\)/);
                            if (requestIdMatch && requestIdMatch[1]) {
                                const requestId = parseInt(requestIdMatch[1]);
                                const request = DB.requests.find(r => r.id === requestId);
                                
                                if (request && request.documents && request.documents.length > 0) {
                                    const cardContent = document.querySelector('.card > div:last-child');
                                    if (!cardContent) return;
                                    
                                    const actionButtonsContainer = cardContent.querySelector('div[style*="display: flex; gap: 10px; margin-top: 20px"]');
                                    if (!actionButtonsContainer) return;
                                    
                                    // Check if a Sign Documents button already exists
                                    const existingSignButton = Array.from(actionButtonsContainer.children)
                                        .find(child => child.textContent === 'Sign Documents');
                                    
                                    if (!existingSignButton) {
                                        const signBtn = document.createElement('button');
                                        signBtn.className = 'success';
                                        signBtn.textContent = 'Sign Documents';
                                        signBtn.onclick = () => viewDocumentSignatures(requestId);
                                        actionButtonsContainer.appendChild(signBtn);
                                    }
                                }
                            }
                        }
                    }, 200);
                };
            });
        }, 200);
    };
    
    // Override navigation functions to ensure sign buttons are added
    ['loadAllRequests', 'loadMyRequests', 'loadPendingApprovals', 'loadDashboard'].forEach(functionName => {
        const originalFunction = window[functionName];
        window[functionName] = function() {
            originalFunction.apply(this, arguments);
            addSignButtonsToViews();
        };
    });
    
    console.log("Document signing fixes applied successfully");
})();