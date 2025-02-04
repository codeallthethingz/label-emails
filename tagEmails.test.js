// First, create a global scope for the functions
global.tagEmails = null;
global.markUnread = null;
global.loadLabelsFromContacts = null;
global.cleanGroups = null;
global.dedupAndSort = null;
global.createToFilter = null;

// Load the file contents and evaluate it in this context
const fs = require('fs');
const indexContent = fs.readFileSync('./index.js', 'utf8');
eval(indexContent);

const {
    MockGmailMessage,
    MockGmailThread,
    MockContact,
    MockContactGroup,
} = require('./mocks');

describe('tagEmails', () => {
    beforeEach(() => {
        // Clear all mock implementations
        jest.clearAllMocks();
    });

    test('should correctly tag email from contact with isithuman:human label', () => {
        // Setup test data
        const testEmail = 'test@example.com';
        const testSubject = 'Test Subject';

        // Create mock message and thread
        const mockMessage = new MockGmailMessage(
            testSubject,
            `Test User <${testEmail}>`
        );
        const mockThread = new MockGmailThread([mockMessage]);

        // Setup mock contact with isithuman:human group
        const mockContactGroup = new MockContactGroup('isithuman:human');
        const mockContact = new MockContact([mockContactGroup]);

        // Setup mock responses
        GmailApp.search.mockReturnValue([mockThread]);
        ContactsApp.getContactsByEmailAddress.mockReturnValue([mockContact]);

        // Run the function
        tagEmails();

        // Assertions
        expect(GmailApp.search).toHaveBeenCalledWith('in:inbox -label:human', 0, 10);
        expect(ContactsApp.getContactsByEmailAddress).toHaveBeenCalledWith(testEmail.toLowerCase());

        // Verify labels were applied correctly
        expect(GmailApp.createLabel).toHaveBeenCalledWith('human');
        expect(mockThread.labels.length).toBe(1);
        expect(mockThread.labels[0].getName()).toBe('human');

        // Verify thread was not archived (because it has 'human' label)
        expect(mockThread.archived).toBeFalsy();
    });

    test('should apply screener label when no matching contacts found', () => {
        // Setup test data
        const testEmail = 'unknown@example.com';
        const testSubject = 'Unknown Sender';

        // Create mock message and thread
        const mockMessage = new MockGmailMessage(
            testSubject,
            `Unknown <${testEmail}>`
        );
        const mockThread = new MockGmailThread([mockMessage]);

        // Setup mock responses
        GmailApp.search.mockReturnValue([mockThread]);
        ContactsApp.getContactsByEmailAddress.mockReturnValue([]);

        // Run the function
        tagEmails();

        // Assertions
        expect(ContactsApp.getContactsByEmailAddress).toHaveBeenCalledWith(testEmail.toLowerCase());

        // Verify screener label was applied
        expect(GmailApp.createLabel).toHaveBeenCalledWith('screener');
        expect(mockThread.labels.length).toBe(1);
        expect(mockThread.labels[0].getName()).toBe('screener');

        // Verify thread was archived
        expect(mockThread.archived).toBeTruthy();
    });
}); 