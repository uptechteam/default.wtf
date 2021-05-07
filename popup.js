function signIn(email) { // A builder that returns a function to set the url to allow the user to log in to a signed out account
  return (responses) => {
      let response = responses[0]
        , url;
      if (response.url.includes('google')) { // Weak test for if Google will redirect to that url
          url = new URL(response.url);
      } else {
          url = new URL('https://www.google.com/webhp');
      }
      let params = new URLSearchParams(url.search);

      // This empties the authuser and moves it to the end to model the format that Google uses for this
      params.delete('authuser'); 
      params.set('authuser', '');

      url.search = params.toString();
      let newURL = 'https://accounts.google.com/AccountChooser?source=ogb&continue='+encodeURIComponent(url.toString())+'&Email='+email;
      
      window.open(newURL);
      window.close(); // Just in case
      
  }
}

function populate(response) { // Create the GUI from the strange nested Array structure that Google accounts responds with
  chrome.storage.sync.get("defaultAccount", (data) => {
    const defaultAccount = data.defaultAccount
    response[1].forEach(info => { // There is useless info in response[0]; response[1] has the accounts
      let a = document.createElement('a');
      a.classList.add('topA')
      
      let img = document.createElement('img');
      img.classList.add('img')
      img.src = info[4]; // Profile image URL
      a.appendChild(img);
      
      let topDiv = document.createElement('div');
      topDiv.classList.add('top')
      
      let nameDiv = document.createElement('div');
      nameDiv.classList.add('name')
      nameDiv.appendChild(document.createTextNode(info[2])); // Name
      topDiv.appendChild(nameDiv);
      
      let emailDiv = document.createElement('div');
      emailDiv.classList.add('email')
      emailDiv.appendChild(document.createTextNode(info[3])); // Email
      topDiv.appendChild(emailDiv);
      
      a.appendChild(topDiv);
      
      if (info.length < 16) { // If the account is signed out (as far as I know)
          let cornerDiv = document.createElement('div');
          cornerDiv.classList.add('corner')
          cornerDiv.appendChild(document.createTextNode('Signed out'));
          a.appendChild(cornerDiv);
          a.addEventListener('click', () => {
            chrome.tabs.query({ // Get current tab
              active: true,
              currentWindow: true
          }, signIn(info[3])); // Navigate to signin
          });
      } else {
          if (info[7] == defaultAccount) { // Account index (pretty sure)
              let cornerDiv = document.createElement('div');
              cornerDiv.classList.add('corner')
              cornerDiv.appendChild(document.createTextNode('Selected'));
              a.appendChild(cornerDiv);
          }
          a.addEventListener("click", async () => {
            chrome.storage.sync.set({ defaultAccount: info[7] }, function() {
              window.close();
            });
          
          })
      }
      document.body.appendChild(a);
    });
  });
}

chrome.runtime.sendMessage(null, populate);