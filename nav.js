function navigate(pageId) {
  document.querySelectorAll('.page').forEach(function(p) {
    p.classList.remove('active');
  });
  var target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo(0, 0);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('[data-page]').forEach(function(el) {
    el.addEventListener('click', function() {
      navigate(this.getAttribute('data-page'));
    });
  });
});
