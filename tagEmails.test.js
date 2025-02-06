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
    MockLabel
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

        // Setup mock People API responses
        People.People.searchContacts.mockReturnValue({
            results: [{
                person: {
                    memberships: [{
                        contactGroupMembership: {
                            contactGroupResourceName: 'contactGroups/123'
                        }
                    }]
                }
            }]
        });

        People.ContactGroups.get.mockReturnValue({
            name: 'isithuman:human'
        });

        // Setup mock Gmail responses
        GmailApp.search.mockReturnValue([mockThread]);

        // Run the function
        tagEmails();

        // Assertions
        expect(GmailApp.search).toHaveBeenCalledWith('in:inbox -label:human', 0, 10);
        expect(People.People.searchContacts).toHaveBeenCalledWith({
            query: testEmail.toLowerCase(),
            readMask: 'memberships'
        });

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

        // Setup mock People API responses
        People.People.searchContacts.mockReturnValue({});

        // Setup mock Gmail responses
        GmailApp.search.mockReturnValue([mockThread]);

        // Run the function
        tagEmails();

        // Assertions
        expect(People.People.searchContacts).toHaveBeenCalledWith({
            query: testEmail.toLowerCase(),
            readMask: 'memberships'
        });

        // Verify screener label was applied
        expect(GmailApp.createLabel).toHaveBeenCalledWith('screener');
        expect(mockThread.labels.length).toBe(1);
        expect(mockThread.labels[0].getName()).toBe('screener');

        // Verify thread was archived
        expect(mockThread.archived).toBeTruthy();
    });

    test('should handle multiple messages in a thread', () => {
        const mockMessages = [
            new MockGmailMessage('Subject 1', 'User1 <user1@example.com>'),
            new MockGmailMessage('Subject 2', 'User2 <user2@example.com>')
        ];
        const mockThread = new MockGmailThread(mockMessages);

        // Setup People API responses for both emails
        People.People.searchContacts
            .mockReturnValueOnce({
                results: [{
                    person: {
                        memberships: [{
                            contactGroupMembership: {
                                contactGroupResourceName: 'contactGroups/123'
                            }
                        }]
                    }
                }]
            })
            .mockReturnValueOnce({
                results: [{
                    person: {
                        memberships: [{
                            contactGroupMembership: {
                                contactGroupResourceName: 'contactGroups/456'
                            }
                        }]
                    }
                }]
            });

        People.ContactGroups.get
            .mockReturnValueOnce({ name: 'isithuman:human' })
            .mockReturnValueOnce({ name: 'isithuman:reading' });

        GmailApp.search.mockReturnValue([mockThread]);

        tagEmails();

        expect(People.People.searchContacts).toHaveBeenCalledTimes(2);
        expect(mockThread.labels.length).toBe(2);
        expect(mockThread.labels.map(l => l.getName()).sort()).toEqual(['human', 'reading']);
        expect(mockThread.archived).toBeFalsy();
    });

    test('should handle API errors gracefully', () => {
        const mockMessage = new MockGmailMessage(
            'Subject',
            'User <user@example.com>'
        );
        const mockThread = new MockGmailThread([mockMessage]);

        People.People.searchContacts.mockImplementation(() => {
            throw new Error('API Error');
        });

        GmailApp.search.mockReturnValue([mockThread]);

        tagEmails();

        expect(mockThread.labels.length).toBe(1);
        expect(mockThread.labels[0].getName()).toBe('screener');
        expect(mockThread.archived).toBeTruthy();
    });
});

describe('markUnread', () => {
    test('should mark read messages as unread', () => {
        const mockMessage = new MockGmailMessage('Subject', 'from@example.com', false);
        const mockThread = new MockGmailThread([mockMessage]);
        const mockLabel = new MockLabel('screener');
        mockLabel.threads.push(mockThread);

        GmailApp.getUserLabelByName.mockReturnValue(mockLabel);

        markUnread('screener');

        expect(mockMessage.isUnread()).toBeTruthy();
    });

    test('should handle non-existent label', () => {
        GmailApp.getUserLabelByName.mockReturnValue(null);

        markUnread('non-existent');

        expect(GmailApp.getUserLabelByName).toHaveBeenCalledWith('non-existent');
    });
});

describe('cleanGroups', () => {
    test('should filter out system labels and handle "read" replacement', () => {
        const input = ['inbox', 'read', 'human', 'spam', 'custom'];
        const result = cleanGroups(input);
        expect(result).toEqual(['human', 'custom', 'reading']);
    });
});

describe('dedupAndSort', () => {
    test('should deduplicate, sort, and prioritize human label', () => {
        const input = ['b', 'a', 'human', 'b', 'c', 'human'];
        const result = dedupAndSort(input);
        expect(result).toEqual(['human', 'a', 'b', 'c']);
    });
}); 