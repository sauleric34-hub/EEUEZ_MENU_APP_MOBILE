/* ═══════════════════════════════════════════════════════════
   Éditeur de barème de livraison par distance — comportement
   partagé entre l'espace restaurant et le panel admin.

   Chaque tranche = « jusqu'à X km → Y F ». Ce script :
     · numérote les tranches et calcule/affiche la distance
       réellement couverte par chacune (ce qui manquait à
       l'affichage — cf. bug de localisation côté template) ;
     · signale en rouge une distance non croissante ou invalide ;
     · pré-remplit une nouvelle tranche à partir de la précédente ;
     · affiche un aperçu du barème tel que le client le vivra.
   ═══════════════════════════════════════════════════════════ */
(function () {
  function parseNum(v) {
    var n = parseFloat(v);
    return isNaN(n) ? null : n;
  }

  // Affichage FR : virgule décimale, sans zéro inutile (5.0 → "5", 5.5 → "5,5").
  function fmtKm(n) {
    var r = Math.round(n * 10) / 10;
    var s = Number.isInteger(r) ? String(r) : r.toFixed(1);
    return s.replace('.', ',');
  }

  function fmtPrix(n) {
    return Math.round(n).toLocaleString('fr-FR') + ' F';
  }

  function initEditor(editor) {
    var rowsEl = editor.querySelector('[data-rows]');
    var template = editor.querySelector('template[data-row-template]');
    var addBtn = editor.querySelector('[data-add-row]');
    var emptyEl = editor.querySelector('[data-empty]');
    var summaryEl = editor.querySelector('[data-summary]');
    var summaryList = editor.querySelector('[data-summary-list]');
    var submitBtn = editor.querySelector('[data-submit]');
    if (!rowsEl || !template) return;

    function rows() {
      return Array.prototype.slice.call(rowsEl.querySelectorAll('[data-bareme-row]'));
    }

    function bindRow(row) {
      row.querySelector('[data-remove]').addEventListener('click', function () {
        row.remove();
        refresh();
      });
      row.querySelector('[data-km]').addEventListener('input', refresh);
      row.querySelector('[data-prix]').addEventListener('input', refresh);
    }

    function refresh() {
      var list = rows();
      var prevKm = 0;
      var hasErreur = false;
      var tranches = [];

      list.forEach(function (row, i) {
        var numEl = row.querySelector('[data-num]');
        if (numEl) numEl.textContent = String(i + 1);
        var kmInput = row.querySelector('[data-km]');
        var prixInput = row.querySelector('[data-prix]');
        var rangeEl = row.querySelector('[data-range]');
        var km = parseNum(kmInput.value);
        var prix = parseNum(prixInput.value);
        var vide = kmInput.value.trim() === '' && prixInput.value.trim() === '';
        var erreur = !vide && (km === null || km <= prevKm);

        row.classList.toggle('bareme-row--error', erreur);

        if (rangeEl) {
          if (vide) {
            rangeEl.textContent = 'Nouvelle tranche';
          } else if (erreur) {
            rangeEl.textContent = km === null
              ? 'Distance invalide'
              : 'Doit dépasser ' + fmtKm(prevKm) + ' km';
          } else {
            rangeEl.textContent = 'Clients entre ' + (i === 0 ? '0' : fmtKm(prevKm)) + ' et ' + fmtKm(km) + ' km';
          }
        }

        if (erreur) hasErreur = true;
        if (!vide && km !== null) {
          prevKm = km;
          if (prix !== null) tranches.push({ km: km, prix: prix });
        }
      });

      if (emptyEl) emptyEl.hidden = list.length !== 0;
      rowsEl.hidden = list.length === 0;

      if (summaryEl && summaryList) {
        if (!tranches.length) {
          summaryEl.hidden = true;
        } else {
          summaryEl.hidden = false;
          var html = tranches.map(function (t, i) {
            var bas = i === 0 ? '0' : fmtKm(tranches[i - 1].km);
            return '<li><span>' + bas + ' – ' + fmtKm(t.km) + ' km</span><strong>' + fmtPrix(t.prix) + '</strong></li>';
          }).join('');
          html += '<li class="bareme-summary-out"><span>Au-delà de ' + fmtKm(tranches[tranches.length - 1].km) + ' km</span><strong>Hors zone</strong></li>';
          summaryList.innerHTML = html;
        }
      }

      if (submitBtn) submitBtn.disabled = hasErreur;
    }

    rows().forEach(bindRow);

    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var list = rows();
        var last = list[list.length - 1];
        var frag = template.content.cloneNode(true);
        var row = frag.querySelector('[data-bareme-row]');
        rowsEl.appendChild(frag);
        bindRow(row);

        var kmInput = row.querySelector('[data-km]');
        var prixInput = row.querySelector('[data-prix]');
        if (last) {
          var lastKm = parseNum(last.querySelector('[data-km]').value);
          var lastPrix = parseNum(last.querySelector('[data-prix]').value);
          kmInput.value = lastKm !== null ? Math.round((lastKm + 5) * 10) / 10 : '';
          prixInput.value = lastPrix !== null ? Math.round((lastPrix + 300) / 50) * 50 : '';
        } else {
          kmInput.value = 5;
          prixInput.value = 500;
        }

        refresh();
        kmInput.focus();
        if (window.gsap) gsap.from(row, { opacity: 0, y: -6, duration: 0.25 });
      });
    }

    refresh();
  }

  document.addEventListener('DOMContentLoaded', function () {
    Array.prototype.forEach.call(document.querySelectorAll('[data-bareme-editor]'), initEditor);
  });
})();
