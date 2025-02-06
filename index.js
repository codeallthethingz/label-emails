function tagEmails() {
  console.log('tagEmails()');
  const threads = GmailApp.search("in:inbox -label:human", 0, 10);

  for (const th of threads) {
    console.log('Processing: ' + th.getMessages()[0].getSubject());
    let applyGroups = [];

    for (const m of th.getMessages()) {
      let from = m.getFrom().replace(/.*<([^>]+)>.*/, "$1").toLowerCase();
      console.log('  From:', from);

      let matchingGroups = getContactGroupsByEmail(from);
      for (const group of matchingGroups) {
        if (group.startsWith('isithuman:')) {
          applyGroups.push(group.substring('isithuman:'.length));
        }
      }
    }

    applyGroups = cleanGroups(applyGroups);

    if (applyGroups.length === 0) {
      applyGroups.push('screener');
      console.log("NEED TO SCREEN", th.getMessages()[0].getSubject());
    }

    console.log('  Applying labels:', applyGroups);

    for (const applyGroup of applyGroups) {
      let label = GmailApp.createLabel(applyGroup);
      th.addLabel(label);
    }

    if (!applyGroups.includes('human')) {
      th.moveToArchive();
    }

    if (applyGroups.includes('screened-out')) {
      createToFilter(from);
    }
  }

  markUnread('screener');
}

function getContactGroupsByEmail(email) {
  try {
    // Search contacts by email (fixed: uses correct API call)
    const response = People.People.searchContacts({
      query: email,
      readMask: 'memberships'
    });

    let groupNames = [];
    if (response.results) {
      for (const contact of response.results) {
        if (contact.person.memberships) {
          for (const membership of contact.person.memberships) {
            if (membership.contactGroupMembership) {
              let groupResource = membership.contactGroupMembership.contactGroupResourceName;
              let groupName = getContactGroupName(groupResource);
              if (groupName) {
                groupNames.push(groupName);
              }
            }
          }
        }
      }
    }

    return groupNames;
  } catch (e) {
    console.error("Error fetching contact groups:", e);
    return [];
  }
}

function getContactGroupName(resourceName) {
  try {
    const group = People.ContactGroups.get(resourceName);
    return group.name || null;
  } catch (e) {
    console.error("Error fetching contact group name:", e);
    return null;
  }
}

function markUnread(labelName) {
  console.log(`Marking read messages with label "${labelName}" as unread.`);
  const label = GmailApp.getUserLabelByName(labelName);
  if (!label) {
    console.log(`Label "${labelName}" does not exist.`);
    return;
  }
  const threads = label.getThreads();
  if (threads.length === 0) {
    console.log(`No unread threads in ${labelName}`);
    return;
  }

  for (const thread of threads) {
    const messages = thread.getMessages();
    for (const message of messages) {
      if (!message.isUnread()) {
        message.markUnread();
        console.log(`Marked message "${message.getSubject()}" as unread.`);
      }
    }
  }
  console.log(`Finished marking read messages with label "${labelName}" as unread.`);
}

function cleanGroups(groups) {
  let newGroups = groups.filter(g => ![
    'inbox', 'sent', 'starred', 'snoozed', 'important',
    'chats', 'scheduled', 'drafts', 'all', 'all mail',
    'spam', 'trash'
  ].includes(g));

  newGroups = newGroups.map(g => g === 'read' ? 'reading' : g);
  newGroups = dedupAndSort(newGroups);
  return newGroups;
}

function dedupAndSort(array) {
  let uniqueSortedArray = Array.from(new Set(array)).sort();
  if (uniqueSortedArray.includes('human')) {
    uniqueSortedArray = ['human', ...uniqueSortedArray.filter(x => x !== 'human')];
  }
  return uniqueSortedArray;
}

function createToFilter(toAddress) {
  const filters = Gmail.Users.Settings.Filters.list('me');
  if (filters?.filter?.some(filter => filter.criteria.to === toAddress)) return;

  const filter = Gmail.newFilter();
  filter.criteria = Gmail.newFilterCriteria();
  filter.criteria.to = toAddress;

  filter.action = Gmail.newFilterAction();
  filter.action.removeLabelIds = ["INBOX"];

  const labelName = 'screened-out';
  GmailApp.createLabel(labelName);

  const labelList = Gmail.Users.Labels.list('me');
  const labelId = labelList.labels.find(a => a.name === labelName)?.id;
  filter.action.addLabelIds = [labelId];

  Gmail.Users.Settings.Filters.create(filter, 'me');
}