function setupUI() {
    for (const item of servicesJSON) {
      let a = document.createElement("a");
      a.classList.add("topA");

      let topDiv = document.createElement("div");
      topDiv.classList.add("top");
  
      let nameDiv = document.createElement("div");
      nameDiv.classList.add("name");
      nameDiv.appendChild(document.createTextNode(item.name)); // Name
      topDiv.appendChild(nameDiv);

      let emailDiv = document.createElement("div");
      emailDiv.classList.add("email");
      emailDiv.appendChild(document.createTextNode(item.url)); // Email
      topDiv.appendChild(emailDiv);

      a.appendChild(topDiv);
      document.getElementById('rules_body').appendChild(a);
    }
}

const servicesJSON = JSON.parse(`
[
  {
      "name": "Calendar",
      "url": "https://calendar.google.com/"
  },
  {
      "name": "Drive",
      "url": "https://drive.google.com/"
  },
  {
      "name": "Maps",
      "url": "https://maps.google.com/"
  },
  {
      "name": "Meet",
      "url": "https://meet.google.com/"
  },
  {
      "name": "Docs",
      "url": "https://docs.google.com/"
  }
]
`);



setupUI();