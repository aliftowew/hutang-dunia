/* global d3, topojson, DEBT_DATA, DEBT_BY_ISO, METRICS */
(function () {
  'use strict';

  var state = {
    metric: 'debtToGdp',
    selectedIso: null,
    sortKey: 'debtToGdp',
    sortDir: 'desc',
    search: '',
  };

  var fmt = {
    pct: function (v) { return v.toFixed(0) + '%'; },
    usd: function (v) {
      if (v >= 1000) return '$' + (v / 1000).toFixed(1) + ' T';
      return '$' + v.toFixed(0) + ' M';
    },
    metricValue: function (m, d) {
      if (m === 'debtUsdBn') return fmt.usd(d.debtUsdBn);
      return d[m].toFixed(0) + '%';
    },
  };

  // Skala warna per metrik (threshold)
  function colorScale(metricKey) {
    var m = METRICS[metricKey];
    return d3.scaleThreshold().domain(m.domain.slice(1, -1).concat(m.domain.slice(-1)))
      .range(m.colors);
  }
  function colorFor(metricKey, d) {
    if (!d) return null;
    return colorScale(metricKey)(d[metricKey]);
  }

  // ---------- Ringkasan / kartu statistik ----------
  function renderStats() {
    var total = d3.sum(DEBT_DATA, function (d) { return d.debtUsdBn; });
    var avgD2G = d3.mean(DEBT_DATA, function (d) { return d.debtToGdp; });
    var topD2G = DEBT_DATA.slice().sort(function (a, b) { return b.debtToGdp - a.debtToGdp; })[0];
    var topInt = DEBT_DATA.slice().sort(function (a, b) { return b.interestToRev - a.interestToRev; })[0];

    var cards = [
      { val: '$' + (total / 1000).toFixed(1) + ' T', lbl: 'Total utang ' + DEBT_DATA.length + ' negara (perkiraan)', sub: '' },
      { val: avgD2G.toFixed(0) + '%', lbl: 'Rata-rata rasio Utang/PDB', sub: '' },
      { val: topD2G.debtToGdp + '%', lbl: 'Rasio Utang/PDB tertinggi', sub: topD2G.name },
      { val: topInt.interestToRev + '%', lbl: 'Beban Bunga/APBN tertinggi', sub: topInt.name },
    ];
    var g = d3.select('#statsGrid');
    var sel = g.selectAll('.stat').data(cards);
    var en = sel.enter().append('div').attr('class', 'stat');
    en.append('div').attr('class', 'val');
    en.append('div').attr('class', 'lbl');
    en.append('div').attr('class', 'sub');
    var merged = en.merge(sel);
    merged.select('.val').text(function (d) { return d.val; });
    merged.select('.lbl').text(function (d) { return d.lbl; });
    merged.select('.sub').text(function (d) { return d.sub; });
  }

  // ---------- Peta ----------
  var mapEls = {};
  function initMap() {
    var topoPromise = window.WORLD_TOPO
      ? Promise.resolve(window.WORLD_TOPO)
      : d3.json('vendor/countries-50m.json');
    topoPromise.then(function (topo) {
      var countries = topojson.feature(topo, topo.objects.countries).features;
      var holder = document.getElementById('map');
      holder.innerHTML = '';
      var width = 960, height = 500;
      var svg = d3.select(holder).append('svg')
        .attr('viewBox', '0 0 ' + width + ' ' + height)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      var projection = d3.geoNaturalEarth1().fitSize([width, height], { type: 'Sphere' });
      var path = d3.geoPath(projection);

      svg.append('path').attr('d', path({ type: 'Sphere' }))
        .style('fill', 'var(--sea)');

      var g = svg.append('g');
      mapEls.paths = g.selectAll('path').data(countries).enter().append('path')
        .attr('d', path)
        .attr('class', function (f) {
          var iso = pad3(f.id);
          return 'country' + (DEBT_BY_ISO[iso] ? ' has-data' : '');
        })
        .style('fill', 'var(--no-data)')
        .on('mousemove', function (event, f) {
          var d = DEBT_BY_ISO[pad3(f.id)];
          if (d) showTooltip(event, d);
        })
        .on('mouseleave', hideTooltip)
        .on('click', function (event, f) {
          var d = DEBT_BY_ISO[pad3(f.id)];
          if (d) selectCountry(d.iso);
        });

      // Zoom & pan
      var zoom = d3.zoom().scaleExtent([1, 8]).on('zoom', function (event) {
        g.attr('transform', event.transform);
      });
      svg.call(zoom);

      paintMap();
    }).catch(function (err) {
      document.getElementById('map').innerHTML =
        '<div class="map-loading">Gagal memuat peta. Jalankan lewat server lokal (mis. <code>python3 -m http.server</code>).</div>';
      console.error(err);
    });
  }

  function pad3(id) { return ('00' + id).slice(-3); }

  function paintMap() {
    if (!mapEls.paths) return;
    var m = state.metric;
    mapEls.paths
      .style('fill', function (f) {
        var d = DEBT_BY_ISO[pad3(f.id)];
        return d ? colorFor(m, d) : 'var(--no-data)';
      })
      .classed('selected', function (f) {
        var d = DEBT_BY_ISO[pad3(f.id)];
        return d && d.iso === state.selectedIso;
      });
  }

  // ---------- Legenda ----------
  function renderLegend() {
    var m = METRICS[state.metric];
    var lg = d3.select('#legend');
    lg.html('');
    lg.append('span').attr('class', 'lg-title').text('Legenda (' + m.short + '):');
    m.colors.forEach(function (c, i) {
      var lo = m.domain[i];
      var hi = m.domain[i + 1];
      var lbl;
      if (m.key === 'debtUsdBn') {
        lbl = (lo >= 1000 ? (lo / 1000) + 'T' : lo) + (hi ? '–' + (hi >= 1000 ? (hi / 1000) + 'T' : hi) : '+');
      } else {
        lbl = lo + (i === m.colors.length - 1 ? '%+' : '–' + hi + '%');
      }
      var item = lg.append('span').attr('class', 'lg-item');
      item.append('span').attr('class', 'sw').style('background', c);
      item.append('span').text(lbl);
    });
  }

  // ---------- Tooltip ----------
  var tt = document.getElementById('tooltip');
  function showTooltip(event, d) {
    tt.hidden = false;
    tt.innerHTML = '<b>' + d.name + '</b>' +
      row('Utang/PDB', d.debtToGdp + '%') +
      row('Bunga/APBN', d.interestToRev + '%') +
      row('Utang', fmt.usd(d.debtUsdBn));
    var x = event.clientX + 14, y = event.clientY + 14;
    if (x + 230 > window.innerWidth) x = event.clientX - 230;
    tt.style.left = x + 'px';
    tt.style.top = y + 'px';
    function row(a, b) { return '<div class="tt-row"><span>' + a + '</span><span>' + b + '</span></div>'; }
  }
  function hideTooltip() { tt.hidden = true; }

  // ---------- Panel detail ----------
  function selectCountry(iso) {
    state.selectedIso = iso;
    paintMap();
    renderDetail();
    renderTable();
    highlightScatter();
    var d = DEBT_BY_ISO[iso];
    if (d && window.innerWidth < 900) {
      document.getElementById('detailCard').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function renderDetail() {
    var d = DEBT_BY_ISO[state.selectedIso];
    var empty = document.getElementById('detailEmpty');
    var body = document.getElementById('detailBody');
    if (!d) { empty.hidden = false; body.hidden = true; return; }
    empty.hidden = true; body.hidden = false;

    var maxD2G = 250, maxInt = 60;
    body.innerHTML =
      '<h3 class="d-name">' + d.name + '</h3>' +
      '<p class="d-region">' + d.region + ' · PDB ≈ ' + fmt.usd(d.gdpUsdBn) + '</p>' +
      metricRow('Utang terhadap PDB', d.debtToGdp + '%', d.debtToGdp / maxD2G, colorFor('debtToGdp', d),
        d.debtToGdp > 100 ? 'Utang melebihi seluruh PDB satu tahun.' : 'Utang di bawah nilai PDB setahun.') +
      metricRow('Beban bunga terhadap APBN', d.interestToRev + '%', d.interestToRev / maxInt, colorFor('interestToRev', d),
        d.interestToRev + '% pendapatan negara habis untuk membayar bunga utang.') +
      metricRow('Nilai utang absolut', fmt.usd(d.debtUsdBn), d.debtUsdBn / 36000, colorFor('debtUsdBn', d),
        'Total nilai utang pemerintah dalam dolar AS.');

    function metricRow(label, val, frac, color, note) {
      frac = Math.max(0.02, Math.min(1, frac));
      return '<div class="d-metric">' +
        '<div class="dm-top"><span class="dm-label">' + label + '</span><span class="dm-val">' + val + '</span></div>' +
        '<div class="d-bar"><span style="width:' + (frac * 100).toFixed(1) + '%;background:' + color + '"></span></div>' +
        '<div class="d-note">' + note + '</div></div>';
    }
  }

  // ---------- Grafik batang ----------
  function renderBar() {
    var m = METRICS[state.metric];
    document.getElementById('barTitle').textContent = 'Peringkat: ' + m.label;
    document.getElementById('barHint').textContent = '15 negara teratas';

    var data = DEBT_DATA.slice().sort(function (a, b) { return b[state.metric] - a[state.metric]; }).slice(0, 15);
    var holder = d3.select('#barChart');
    holder.html('');

    var margin = { top: 6, right: 54, bottom: 6, left: 120 };
    var barH = 24, gap = 6;
    var width = 520;
    var height = data.length * (barH + gap) + margin.top + margin.bottom;
    var innerW = width - margin.left - margin.right;

    var svg = holder.append('svg').attr('viewBox', '0 0 ' + width + ' ' + height).attr('width', '100%');
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleLinear().domain([0, d3.max(data, function (d) { return d[state.metric]; })]).range([0, innerW]);
    var cs = colorScale(state.metric);

    var rows = g.selectAll('.brow').data(data).enter().append('g')
      .attr('class', 'brow')
      .attr('transform', function (d, i) { return 'translate(0,' + i * (barH + gap) + ')'; })
      .style('cursor', 'pointer')
      .on('click', function (e, d) { selectCountry(d.iso); });

    rows.append('text').attr('class', 'bar-label').attr('x', -8).attr('y', barH / 2)
      .attr('dy', '.35em').attr('text-anchor', 'end').text(function (d) { return d.name; });

    rows.append('rect').attr('y', 0).attr('height', barH).attr('rx', 4)
      .attr('width', function (d) { return Math.max(2, x(d[state.metric])); })
      .attr('fill', function (d) { return cs(d[state.metric]); })
      .style('stroke', function (d) { return d.iso === state.selectedIso ? 'var(--ink)' : 'none'; })
      .style('stroke-width', 1.5);

    rows.append('text').attr('class', 'bar-value').attr('y', barH / 2).attr('dy', '.35em')
      .attr('x', function (d) { return Math.max(2, x(d[state.metric])) + 6; })
      .text(function (d) { return fmt.metricValue(state.metric, d); });
  }

  // ---------- Scatter ----------
  function renderScatter() {
    var holder = d3.select('#scatterChart');
    holder.html('');
    var width = 520, height = 360;
    var margin = { top: 14, right: 18, bottom: 40, left: 48 };
    var innerW = width - margin.left - margin.right;
    var innerH = height - margin.top - margin.bottom;

    var svg = holder.append('svg').attr('viewBox', '0 0 ' + width + ' ' + height).attr('width', '100%');
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    var x = d3.scaleLinear().domain([0, d3.max(DEBT_DATA, function (d) { return d.debtToGdp; }) * 1.05]).range([0, innerW]);
    var y = d3.scaleLinear().domain([0, d3.max(DEBT_DATA, function (d) { return d.interestToRev; }) * 1.08]).range([innerH, 0]);
    var r = d3.scaleSqrt().domain([0, d3.max(DEBT_DATA, function (d) { return d.debtUsdBn; })]).range([3, 26]);

    // grid + axes
    g.append('g').attr('class', 'grid').call(d3.axisLeft(y).tickSize(-innerW).tickFormat('')).select('.domain').remove();
    g.append('g').attr('class', 'axis').attr('transform', 'translate(0,' + innerH + ')').call(d3.axisBottom(x).ticks(6).tickFormat(function (d) { return d + '%'; }));
    g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(6).tickFormat(function (d) { return d + '%'; }));

    g.append('text').attr('x', innerW / 2).attr('y', innerH + 34).attr('text-anchor', 'middle')
      .attr('class', 'bar-label').text('Utang / PDB (%)');
    g.append('text').attr('transform', 'rotate(-90)').attr('x', -innerH / 2).attr('y', -34).attr('text-anchor', 'middle')
      .attr('class', 'bar-label').text('Bunga / APBN (%)');

    scatterDots = g.selectAll('.dot-c').data(DEBT_DATA).enter().append('circle')
      .attr('class', 'dot-c')
      .attr('cx', function (d) { return x(d.debtToGdp); })
      .attr('cy', function (d) { return y(d.interestToRev); })
      .attr('r', function (d) { return r(d.debtUsdBn); })
      .attr('fill', function (d) { return colorFor('interestToRev', d); })
      .attr('fill-opacity', .62)
      .style('stroke', 'var(--card)')
      .style('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mousemove', function (e, d) { showTooltip(e, d); })
      .on('mouseleave', hideTooltip)
      .on('click', function (e, d) { selectCountry(d.iso); });

    highlightScatter();
  }
  var scatterDots = null;
  function highlightScatter() {
    if (!scatterDots) return;
    scatterDots
      .style('stroke', function (d) { return d.iso === state.selectedIso ? 'var(--ink)' : 'var(--card)'; })
      .style('stroke-width', function (d) { return d.iso === state.selectedIso ? 2.4 : 1; })
      .attr('fill-opacity', function (d) { return d.iso === state.selectedIso ? .95 : .62; });
  }

  // ---------- Tabel ----------
  var PINNED_ISO = '360'; // Indonesia selalu disematkan di baris teratas

  function renderTable() {
    var m = state.sortKey;
    var dir = state.sortDir === 'asc' ? 1 : -1;
    var q = state.search.toLowerCase();
    var data = DEBT_DATA.filter(function (d) {
      if (d.iso === PINNED_ISO) return false; // Indonesia ditangani terpisah (disematkan)
      return !q || d.name.toLowerCase().indexOf(q) >= 0 || d.region.toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) {
      var va = a[m], vb = b[m];
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });

    var tbody = d3.select('#tableBody');
    tbody.html('');
    var d2gScale = colorScale('debtToGdp');

    function addRow(d, pinned) {
      var tr = tbody.append('tr')
        .classed('selected', d.iso === state.selectedIso)
        .classed('pinned', pinned)
        .on('click', function () { selectCountry(d.iso); });
      var nameCell = '<span class="dot" style="background:' + d2gScale(d.debtToGdp) + '"></span>' + d.name;
      if (pinned) nameCell += ' <span class="pin-badge" title="Disematkan">📌</span>';
      tr.append('td').html(nameCell);
      tr.append('td').text(d.region);
      tr.append('td').attr('class', 'num').text(d.debtToGdp + '%');
      tr.append('td').attr('class', 'num').text(d.interestToRev + '%');
      tr.append('td').attr('class', 'num').text(d3.format(',')(d.debtUsdBn));
      tr.append('td').attr('class', 'num').text(d3.format(',')(d.gdpUsdBn));
    }

    // Baris Indonesia yang disematkan (selalu tampil di paling atas)
    var pinnedCountry = DEBT_BY_ISO[PINNED_ISO];
    if (pinnedCountry) addRow(pinnedCountry, true);
    data.forEach(function (d) { addRow(d, false); });

    d3.selectAll('#dataTable th.sortable')
      .classed('sorted-asc', function () { return this.dataset.sort === m && state.sortDir === 'asc'; })
      .classed('sorted-desc', function () { return this.dataset.sort === m && state.sortDir === 'desc'; });
  }

  // ---------- Kontrol metrik ----------
  function setMetric(metric) {
    state.metric = metric;
    state.sortKey = metric === 'debtUsdBn' ? 'debtUsdBn' : metric;
    state.sortDir = 'desc';
    d3.selectAll('#metricSwitch .seg').classed('active', function () { return this.dataset.metric === metric; });
    document.getElementById('metricDesc').textContent = METRICS[metric].desc;
    paintMap();
    renderLegend();
    renderBar();
    renderTable();
  }

  // ---------- Event wiring ----------
  function wire() {
    d3.selectAll('#metricSwitch .seg').on('click', function () { setMetric(this.dataset.metric); });

    d3.selectAll('#dataTable th.sortable').on('click', function () {
      var key = this.dataset.sort;
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = (key === 'name' || key === 'region') ? 'asc' : 'desc'; }
      renderTable();
    });

    document.getElementById('tableSearch').addEventListener('input', function (e) {
      state.search = e.target.value; renderTable();
    });

    document.getElementById('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      this.textContent = next === 'dark' ? '☀️' : '🌙';
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }

  function initTheme() {
    var saved;
    try { saved = localStorage.getItem('theme'); } catch (e) {}
    if (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) saved = 'dark';
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      document.getElementById('themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
    }
  }

  // ---------- Init ----------
  initTheme();
  renderStats();
  wire();
  setMetric('debtToGdp');
  renderScatter();
  initMap();
})();
