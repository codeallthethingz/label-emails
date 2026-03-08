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
        GmailApp.search
            .mockReturnValueOnce([mockThread]) // inbox search
            .mockReturnValueOnce([]); // screener search

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
        GmailApp.search
            .mockReturnValueOnce([mockThread]) // inbox search
            .mockReturnValueOnce([]); // screener search

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

        GmailApp.search
            .mockReturnValueOnce([mockThread]) // inbox search
            .mockReturnValueOnce([]); // screener search

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

        GmailApp.search
            .mockReturnValueOnce([mockThread]) // inbox search  
            .mockReturnValueOnce([]); // screener search

        tagEmails();

        expect(mockThread.labels.length).toBe(1);
        expect(mockThread.labels[0].getName()).toBe('screener');
        expect(mockThread.archived).toBeTruthy();
    });

    test('should process screener emails that now have contact groups', () => {
        const testEmail = 'screener@example.com';
        const testSubject = 'Previously Screened Email';

        const mockMessage = new MockGmailMessage(
            testSubject,
            `Screener User <${testEmail}>`
        );
        const mockThread = new MockGmailThread([mockMessage]);

        const screenerLabel = new MockLabel('screener');
        mockThread.addLabel(screenerLabel);

        People.People.searchContacts.mockReturnValue({
            results: [{
                person: {
                    memberships: [{
                        contactGroupMembership: {
                            contactGroupResourceName: 'contactGroups/789'
                        }
                    }]
                }
            }]
        });

        People.ContactGroups.get.mockReturnValue({
            name: 'isithuman:human'
        });

        GmailApp.search
            .mockReturnValueOnce([])
            .mockReturnValueOnce([mockThread]);

        GmailApp.getUserLabelByName.mockImplementation(name => name === 'screener' ? screenerLabel : null);

        tagEmails();

        expect(GmailApp.search).toHaveBeenCalledWith('in:inbox -label:human', 0, 10);
        expect(GmailApp.search).toHaveBeenCalledWith('label:screener', 0, 50);

        expect(mockThread.removeLabel).toHaveBeenCalledWith(screenerLabel);
        expect(mockThread.markUnread).toHaveBeenCalled();
        expect(mockThread.moveToInbox).toHaveBeenCalled();
        expect(GmailApp.createLabel).toHaveBeenCalledWith('human');
        expect(mockThread.labels.some(l => l.getName() === 'human')).toBeTruthy();
        expect(mockThread.archived).toBeFalsy();
    });

    test('should keep screener emails without contact groups in screener', () => {
        const testEmail = 'stillunknown@example.com';
        const testSubject = 'Still Unknown Email';

        const mockMessage = new MockGmailMessage(
            testSubject,
            `Still Unknown <${testEmail}>`
        );
        const mockThread = new MockGmailThread([mockMessage]);

        const screenerLabel = new MockLabel('screener');
        mockThread.addLabel(screenerLabel);

        People.People.searchContacts.mockReturnValue({});

        GmailApp.search
            .mockReturnValueOnce([])
            .mockReturnValueOnce([mockThread]);

        tagEmails();

        expect(mockThread.removeLabel).not.toHaveBeenCalled();
        expect(mockThread.markUnread).not.toHaveBeenCalled();
        expect(mockThread.labels.some(l => l.getName() === 'screener')).toBeTruthy();
        expect(mockThread.archived).toBeTruthy();
    });

    test('should process screener emails with non-human labels without moving to inbox', () => {
        const testEmail = 'reading@example.com';
        const testSubject = 'Reading Material Email';

        const mockMessage = new MockGmailMessage(
            testSubject,
            `Reading User <${testEmail}>`
        );
        const mockThread = new MockGmailThread([mockMessage]);

        const screenerLabel = new MockLabel('screener');
        mockThread.addLabel(screenerLabel);

        People.People.searchContacts.mockReturnValue({
            results: [{
                person: {
                    memberships: [{
                        contactGroupMembership: {
                            contactGroupResourceName: 'contactGroups/888'
                        }
                    }]
                }
            }]
        });

        People.ContactGroups.get.mockReturnValue({
            name: 'isithuman:reading'
        });

        GmailApp.search
            .mockReturnValueOnce([])
            .mockReturnValueOnce([mockThread]);

        GmailApp.getUserLabelByName.mockImplementation(name => name === 'screener' ? screenerLabel : null);

        tagEmails();

        expect(mockThread.removeLabel).toHaveBeenCalledWith(screenerLabel);
        expect(mockThread.markUnread).toHaveBeenCalled();
        expect(mockThread.moveToInbox).not.toHaveBeenCalled();
        expect(GmailApp.createLabel).toHaveBeenCalledWith('reading');
        expect(mockThread.labels.some(l => l.getName() === 'reading')).toBeTruthy();
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