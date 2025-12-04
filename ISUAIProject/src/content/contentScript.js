console.log("loaddded");
const sidebar = document.createElement("div");
sidebar.id = "ai-sidebar-root";
sidebar.style.position = "fixed";
sidebar.style.top = "0";
sidebar.style.right = "0";
sidebar.style.width = "350px";
sidebar.style.height = "100vh";
sidebar.style.zIndex = "999999";

document.body.appendChild(sidebar);

// Load the React sidebar app
const iframe = document.createElement("iframe");
iframe.src = chrome.runtime.getURL("index.html");
iframe.style.width = "100%";
iframe.style.height = "100%";
iframe.style.border = "none";

sidebar.appendChild(iframe);
console.log("Sidebar container added:", sidebar);
console.log("Iframe element:", iframe);


