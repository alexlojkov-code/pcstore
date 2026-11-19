// Выполняется до отрисовки: отмечает, что JS есть, и нужно ли играть раскладку чертежа.
(function () {
  var d = document.documentElement;
  d.classList.add('js');
  try {
    if (sessionStorage.getItem('bl.explode') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      d.classList.add('explode-done');
    }
  } catch (e) {
    d.classList.add('explode-done');
  }
})();
