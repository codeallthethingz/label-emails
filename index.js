function tagEmails() {
  console.log('tagEmails()')
  threads = GmailApp.search("in:inbox -label:human", 0, 10);
  for (const th of threads) {
    console.log('processing: ' + th.getMessages()[0].getSubject())
    let applyGroups = []
    for (const m of th.getMessages()) {
      console.log('  ' + m.getFrom())
      let from = m.getFrom().replace(/.*<([^>]+)>.*/, "$1");
      from = from.toLowerCase()
      let matchingContacts = ContactsApp.getContactsByEmailAddress(from);
      if (matchingContacts.length > 0) {
        let groups = []
        for (const contact of matchingContacts) {
          groups = groups.concat(contact.getContactGroups())
        }
        if (groups.length > 0) {
          for (const group of groups) {
            if (group.getName().startsWith('isithuman:')) {
              applyGroups.push(group.getName().substring('isithuman:'.length));
            }
          }
        }
      }
    }

    applyGroups = cleanGroups(applyGroups)

    if (applyGroups.length === 0) {
      applyGroups.push('screener');
      console.log("NEED TO SCREEN", th.getMessages()[0].getSubject())
    }

    console.log('  applying', applyGroups)

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
  markUnread('screener')
}

function markUnread(labelName) {
  console.log(`Marking read messages with label "${labelName}" as unread.`);

  // Get the label by name
  const label = GmailApp.getUserLabelByName(labelName);

  if (!label) {
    console.log(`Label "${labelName}" does not exist.`);
    return;
  }

  // Get all threads with this label
  const threads = label.getThreads();

  if (threads.length === 0) {
    console.log(`Unread thereads in ${labelName}: ${threads.length}`)
    return;
  }

  // Loop through threads and mark only read messages as unread
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

function loadLabelsFromContacts() {
  let allGroups = ContactsApp.getContactGroups();
  let results = [];
  for (const group of allGroups) {
    if (group.getName().startsWith('isithuman:')) {
      results.push(group);
    }
  }
  return results;
}

function cleanGroups(groups) {
  let newG = []
  for (const g of groups) {
    if (g === 'read') {
      newG.push('reading')
      continue
    }
    if (g === 'inbox' || g === 'sent' || g === 'starred' || g === 'snoozed' || g === 'important' || g === 'chats' || g === 'scheduled' || g === 'drafts' || g === 'all' || g === 'all mail' || g === 'spam' || g === 'trash') {
      console.log("Cannot apply " + g + " as it is a reserved label")
      continue
    }
    newG.push(g)
  }
  newG = dedupAndSort(newG)
  return newG
}

function dedupAndSort(array) {
  if (!Array.isArray(array)) {
    throw new Error('Input must be an array.');
  }

  // Remove duplicates and sort
  var uniqueSortedArray = Array.from(new Set(array)).sort();

  // Ensure 'human' is at the beginning if it exists
  var humanIndex = uniqueSortedArray.indexOf('human');
  if (humanIndex > -1) {
    uniqueSortedArray.splice(humanIndex, 1); // Remove 'human' from its current position
    uniqueSortedArray.unshift('human'); // Add 'human' at the start
  }

  return uniqueSortedArray;
}

// Creates a filter to put all email from ${toAddress} into
// Gmail label ${labelName}
function createToFilter(toAddress) {

  // Lists all the filters for the user running the script, 'me'
  var filters = Gmail.Users.Settings.Filters.list('me')
  if (filters !== null) {
    for (const filter of filters.filter) {
      if (filter.criteria.to === toAddress) {
        // filter already exists and return.
        return;
      }
    }
  }

  // Create a new filter object (really just POD)
  var filter = Gmail.newFilter()


  // Make the filter activate when the to address is ${toAddress}
  filter.criteria = Gmail.newFilterCriteria()
  filter.criteria.to = toAddress
  // Make the filter remove the label id of ${"INBOX"}
  filter.action = Gmail.newFilterAction()
  filter.action.removeLabelIds = ["INBOX"];
  labelName = 'screened-out';
  GmailApp.createLabel(labelName)

  // Lists all the labels for the user running the script, 'me'
  var labelList = Gmail.Users.Labels.list('me')

  // Search through the existing labels for ${labelName}
  // this operation is still needed to get the label ID 
  var labelId = false
  labelList.labels.forEach(function (a) {
    if (a.name === labelName) {
      labelId = a.id;
    }
  })
  filter.action.addLabelIds = [labelId];

  // Add the filter to the user's ('me') settings
  Gmail.Users.Settings.Filters.create(filter, 'me')
}