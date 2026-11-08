// Runs before first paint (a classic, blocking script in <head>), so the room
// opens in the right light instead of fading in from evening.
// Keep the hours in sync with periodAt() in js/main.js.
(function () {
  var requested = new URLSearchParams(location.search).get('time');
  var times = ['morning', 'afternoon', 'evening', 'night'];
  var h = new Date().getHours();
  var period = h >= 21 || h < 5 ? 'night' : h >= 17 ? 'evening' : h >= 12 ? 'afternoon' : 'morning';
  document.documentElement.dataset.time = times.indexOf(requested) >= 0 ? requested : period;
})();
