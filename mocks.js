class MockGmailThread {
    constructor(messages = []) {
        this.messages = messages;
        this.labels = [];
    }

    getMessages() {
        return this.messages;
    }

    addLabel(label) {
        this.labels.push(label);
    }

    moveToArchive() {
        this.archived = true;
    }
}

class MockGmailMessage {
    constructor(subject, from, isUnread = true) {
        this.subject = subject;
        this.from = from;
        this._isUnread = isUnread;
    }

    getSubject() {
        return this.subject;
    }

    getFrom() {
        return this.from;
    }

    isUnread() {
        return this._isUnread;
    }
}

class MockLabel {
    constructor(name) {
        this.name = name;
        this.threads = [];
    }

    getName() {
        return this.name;
    }

    getThreads() {
        return this.threads;
    }
}

class MockContact {
    constructor(groups = []) {
        this.groups = groups;
    }

    getContactGroups() {
        return this.groups;
    }
}

class MockContactGroup {
    constructor(name) {
        this.name = name;
    }

    getName() {
        return this.name;
    }
}

module.exports = {
    MockGmailMessage,
    MockGmailThread,
    MockContact,
    MockContactGroup,
    MockLabel
};

// Global mock objects
global.GmailApp = {
    search: jest.fn(),
    createLabel: jest.fn(name => new MockLabel(name)),
    getUserLabelByName: jest.fn(name => new MockLabel(name)),
};

global.ContactsApp = {
    getContactsByEmailAddress: jest.fn(() => []),
    getContactGroups: jest.fn(() => []),
};

global.Gmail = {
    Users: {
        Settings: {
            Filters: {
                list: jest.fn(() => ({ data: { filter: [] } })),
                create: jest.fn(),
            }
        },
        Labels: {
            list: jest.fn(() => ({ data: { labels: [] } })),
        }
    },
    newFilter: jest.fn(),
    newFilterCriteria: jest.fn(),
    newFilterAction: jest.fn(),
}; 