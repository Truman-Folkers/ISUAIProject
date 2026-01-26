console.log("loaddded");
const sidebar = document.createElement("div");
sidebar.id = "ai-sidebar-root";
sidebar.style.position = "fixed";
sidebar.style.top = "0";
sidebar.style.right = "0";
sidebar.style.width = "50px";
sidebar.style.height = "100vh";
sidebar.style.borderTopLeftRadius = "25px";
sidebar.style.borderBottomLeftRadius = "25px";
sidebar.style.zIndex = "999999";
sidebar.style.transition = "width 0.3s ease-in-out, box-shadow 0.3s ease-in-out";
sidebar.style.boxShadow = "0px 0 10px rgba(0, 0, 0, 0.15)";
sidebar.addEventListener('mouseover', function(event){
    sidebar.style.width = "34vh";
})
sidebar.addEventListener('mouseout', function(event){
    sidebar.style.width = "50px";
})

document.body.appendChild(sidebar);

// Load the React sidebar app
const iframe = document.createElement("iframe");
iframe.src = chrome.runtime.getURL("src/sidebar/index.html");
iframe.style.width = "100%";
iframe.style.height = "100%";
iframe.style.border = "none";

sidebar.appendChild(iframe);
console.log("Sidebar container added:", sidebar);
console.log("Iframe element:", iframe);


