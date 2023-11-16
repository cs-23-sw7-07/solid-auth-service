// This is your TypeScript code
const homePageUrl: string = 'home.html';
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the buttons
    const rejectButton = document.getElementById('rejectButton');
    const allowButton = document.getElementById('allowButton');
  
    // Add click event listeners to the buttons
    rejectButton?.addEventListener('click', () => {
        window.location.href = homePageUrl + '?status=rejected';
    });
  
    allowButton?.addEventListener('click', () => {
      window.location.href = homePageUrl + '?status=allowed';
    });
  });
  