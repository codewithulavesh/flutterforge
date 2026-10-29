(function () {
  try {
    var theme = localStorage.getItem('ff-theme');
    if (theme !== 'light' && theme !== 'dark') {
      theme = 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    document.documentElement.classList.add(theme);
  } catch (error) {
    // Storage can be unavailable in hardened contexts; the app still boots.
  }
})();
