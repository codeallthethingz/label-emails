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

    removeLabel = jest.fn((label) => {
        const index = this.labels.findIndex(l => l.getName() === label.getName());
        if (index > -1) {
            this.labels.splice(index, 1);
        }
    });

    getLabels() {
        return this.labels;
    }

    markUnread = jest.fn(() => {
        this.messages.forEach(message => message.markUnread());
    });

    moveToInbox = jest.fn(() => {
        this.archived = false;
    });

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

    markUnread() {
        this._isUnread = true;
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

module.exports = {
    MockGmailMessage,
    MockGmailThread,
    MockLabel
};

// Global mock objects
global.GmailApp = {
    search: jest.fn(),
    createLabel: jest.fn(name => new MockLabel(name)),
    getUserLabelByName: jest.fn(() => null),
};

global.People = {
    People: {
        searchContacts: jest.fn(),
    },
    ContactGroups: {
        get: jest.fn(),
    }
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