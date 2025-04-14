// Mock database (would be replaced with actual backend in a real implementation)
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
                    comments: 'Approved as per budget allocation',
                    signature: null
                }
            },
            documents: [
                { name: 'invoice.pdf', uploadedAt: '2025-03-02' }
            ],
            initialFiles: [
                { name: 'requirements.pdf', uploadedAt: '2025-02-28' }
            ],
            comments: []
        },
        { 
            id: 2, 
            title: 'Travel Request',
            description: 'Conference travel request for the marketing team',
            status: 'waiting_approval',
            createdBy: 1,
            createdAt: '2025-03-01',
            deadline: '2025-03-05',
            urgent: true,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: null, 
                    signedAt: null, 
                    comments: null,
                    signature: null
                }
            },
            documents: [],
            initialFiles: [
                { name: 'travel_proposal.docx', uploadedAt: '2025-03-01' }
            ],
            comments: []
        },
        { 
            id: 3, 
            title: 'New Hire Processing',
            description: 'Process onboarding documents for new developer',
            status: 'draft',
            createdBy: 1,
            createdAt: '2025-03-02',
            deadline: '2025-03-15',
            urgent: false,
            assignedTo: null,
            approvals: {},
            documents: [],
            initialFiles: [],
            comments: []
        },
        { 
            id: 4, 
            title: 'Budget Approval for Q2',
            description: 'Need approval for Q2 budget for marketing department',
            status: 'on_hold',
            createdBy: 2, // Jane (Finance approver) created this request
            createdAt: '2025-03-03',
            deadline: '2025-03-20',
            urgent: true,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: null, 
                    signedAt: null, 
                    comments: null,
                    signature: null
                }
            },
            documents: [],
            initialFiles: [
                { name: 'q2_budget_draft.xlsx', uploadedAt: '2025-03-03' }
            ],
            comments: [
                {
                    by: 5, // David (Operations approver)
                    department: 'Operations',
                    date: '2025-03-04',
                    text: 'Please provide detailed breakdown of marketing expenses',
                    type: 'info_request'
                }
            ]
        },
        { 
            id: 5, 
            title: 'Software License Renewal',
            description: 'Annual renewal for development team software licenses',
            status: 'in_review',
            createdBy: 4, // Sarah (IT approver) created this request
            createdAt: '2025-03-04',
            deadline: '2025-03-25',
            urgent: false,
            assignedTo: 'Finance',
            approvals: {
                'Finance': { 
                    signed: false, 
                    signedBy: null, 
                    signedAt: null, 
                    comments: null,
                    signature: null
                }
            },
            documents: [],
            initialFiles: [
                { name: 'license_quote.pdf', uploadedAt: '2025-03-04' }
            ],
            comments: []
        },
        { 
            id: 6, 
            title: 'Office Supplies Order',
            description: 'Monthly order for office supplies and equipment',
            status: 'completed',
            createdBy: 5, // David (Operations approver) created this request
            createdAt: '2025-02-15',
            deadline: '2025-02-25',
            urgent: false,
            assignedTo: 'Operations',
            approvals: {
                'Operations': { 
                    signed: true, 
                    signedBy: 5, 
                    signedAt: '2025-02-18', 
                    comments: 'Approved as per standard procedure',
                    signature: null
                }
            },
            documents: [
                { name: 'delivery_receipt.pdf', uploadedAt: '2025-02-22' },
                { name: 'inventory_update.xlsx', uploadedAt: '2025-02-22' }
            ],
            initialFiles: [
                { name: 'supplies_list.xlsx', uploadedAt: '2025-02-15' }
            ],
            comments: []
        }
    ]
};