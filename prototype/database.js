// Updated database.js with document signature support
const DB = {
    users: [
        { id: 1, name: 'John Doe', username: 'john', password: 'pass123', role: 'requestor', department: null },
        { id: 2, name: 'Jane Smith', username: 'jane', password: 'pass123', role: 'approver', department: 'Finance' },
        { id: 3, name: 'Mike Johnson', username: 'mike', password: 'pass123', role: 'approver', department: 'HR' },
        { id: 4, name: 'Sarah Williams', username: 'sarah', password: 'pass123', role: 'approver', department: 'IT' },
        { id: 5, name: 'David Brown', username: 'david', password: 'pass123', role: 'approver', department: 'Operations' },
        { id: 6, name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin', department: null }
    ],
    requests: [
        { 
            id: 1, 
            title: 'Equipment Purchase',
            description: 'Need to purchase new laptop for development team',
            status: 'approved',
            createdBy: 1,
            createdAt: '2025-02-28',
            deadline: '2025-03-10',
            urgent: false,
            assignedTo: 'IT',
            approvals: {
                'IT': { 
                    signed: true, 
                    signedBy: 4, 
                    signedAt: '2025-03-01', 
                    comments: 'Approved as per budget allocation' 
                }
            },
            documents: [
                { 
                    name: 'invoice.pdf', 
                    uploadedAt: '2025-03-02',
                    requiresSignature: true,
                    signed: true,
                    signedBy: 4,
                    signedAt: '2025-03-03',
                    signatureComments: 'Invoice verified and approved for payment'
                },
                { 
                    name: 'warranty_document.pdf', 
                    uploadedAt: '2025-03-02',
                    requiresSignature: true,
                    signed: false,
                    signedBy: null,
                    signedAt: null,
                    signatureComments: null
                }
            ],
            initialFiles: [
                { name: 'requirements.pdf', uploadedAt: '2025-02-28' }
            ]
        },
        { 
            id: 2, 
            title: 'Travel Request',
            description: 'Conference travel request for the marketing team',
            status: 'waiting for approval',
            createdBy: 1,
            createdAt: '2025-03-01',
            deadline: '2025-03-15',
            urgent: true,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: null, 
                    signedAt: null, 
                    comments: null 
                }
            },
            documents: [],
            initialFiles: [
                { name: 'travel_proposal.docx', uploadedAt: '2025-03-01' }
            ]
        },
        { 
            id: 3, 
            title: 'New Hire Processing',
            description: 'Process onboarding documents for new developer',
            status: 'draft',
            createdBy: 1,
            createdAt: '2025-03-02',
            deadline: '2025-03-20',
            urgent: false,
            assignedTo: null,
            approvals: {},
            documents: [],
            initialFiles: []
        },
        { 
            id: 4, 
            title: 'Office Renovation Proposal',
            description: 'Proposal for renovating the meeting rooms on the second floor',
            status: 'on hold',
            createdBy: 2,  // Created by Jane (Finance approver)
            createdAt: '2025-03-03',
            deadline: '2025-03-25',
            urgent: false,
            assignedTo: 'Operations',
            approvals: {
                'Operations': { 
                    signed: false, 
                    signedBy: 5,
                    signedAt: '2025-03-05',
                    comments: 'Need detailed cost breakdown and vendor quotes' 
                }
            },
            documents: [],
            initialFiles: [
                { name: 'renovation_concept.pdf', uploadedAt: '2025-03-03' }
            ]
        },
        { 
            id: 5, 
            title: 'Annual Budget Review',
            description: 'Review of departmental budget allocations for upcoming fiscal year',
            status: 'in review',
            createdBy: 3,  // Created by Mike (HR approver)
            createdAt: '2025-03-04',
            deadline: '2025-03-18',
            urgent: true,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: null, 
                    signedAt: null, 
                    comments: null 
                }
            },
            documents: [],
            initialFiles: [
                { name: 'budget_proposal.xlsx', uploadedAt: '2025-03-04' },
                { name: 'last_year_review.pdf', uploadedAt: '2025-03-04' }
            ]
        },
        { 
            id: 6, 
            title: 'IT Security Assessment',
            description: 'Request for comprehensive security assessment of corporate network',
            status: 'completed',
            createdBy: 6,  // Created by Admin
            createdAt: '2025-02-15',
            deadline: '2025-03-01',
            urgent: false,
            assignedTo: 'IT',
            approvals: {
                'IT': { 
                    signed: true, 
                    signedBy: 4, 
                    signedAt: '2025-02-20', 
                    comments: 'Approved and scheduled for next week' 
                }
            },
            documents: [
                { 
                    name: 'security_report.pdf', 
                    uploadedAt: '2025-03-05',
                    requiresSignature: true,
                    signed: true,
                    signedBy: 4,
                    signedAt: '2025-03-06',
                    signatureComments: 'Report verified and findings confirmed'
                },
                { 
                    name: 'recommendations.docx', 
                    uploadedAt: '2025-03-05',
                    requiresSignature: false,
                    signed: false,
                    signedBy: null,
                    signedAt: null,
                    signatureComments: null
                }
            ],
            initialFiles: [
                { name: 'scope_document.pdf', uploadedAt: '2025-02-15' }
            ]
        },
        { 
            id: 7, 
            title: 'Employee Training Program',
            description: 'Request for approval of new employee training program',
            status: 'rejected',
            createdBy: 3,  // Created by Mike (HR approver)
            createdAt: '2025-02-25',
            deadline: '2025-03-10',
            urgent: false,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: 2, 
                    signedAt: '2025-03-01', 
                    comments: 'Budget exceeds current allocation. Please revise and resubmit.' 
                }
            },
            documents: [],
            initialFiles: [
                { name: 'training_program.pdf', uploadedAt: '2025-02-25' },
                { name: 'cost_analysis.xlsx', uploadedAt: '2025-02-25' }
            ]
        }
    ],
    // New section for signature logs (audit trail)
    signatureLogs: [
        {
            id: 1,
            requestId: 1,
            documentName: 'invoice.pdf',
            action: 'signed',
            userId: 4,
            timestamp: '2025-03-03T14:23:45',
            comments: 'Invoice verified and approved for payment'
        },
        {
            id: 2,
            requestId: 6,
            documentName: 'security_report.pdf',
            action: 'signed',
            userId: 4,
            timestamp: '2025-03-06T10:12:33',
            comments: 'Report verified and findings confirmed'
        }
    ]
};