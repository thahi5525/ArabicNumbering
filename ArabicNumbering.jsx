/*
  ArabicNumbering.jsx for Adobe Illustrator
  Description: Numbers the selected text objects with Arabic-Indic digits
               (٠١٢٣٤٥٦٧٨٩): range, step, leading zeros, sorting, shuffle
               and replace modes.
  Version: 0.2
  Author: Abuthahir
  GitHub: https://github.com/thahi5525

  Copyright (c) 2026 Abuthahir
*/

//@target illustrator

var GITHUB_URL = 'https://github.com/thahi5525';
var PLACEHOLDER = '{%n}';

// ---- helpers start ----

var HAS_DIGIT = /[0-9\u0660-\u0669]/;
var NUMBER_RE = /[0-9\u0660-\u0669]+(?:[.,\u066B][0-9\u0660-\u0669]+)*/g;

// Replace 0-9 with Arabic-Indic digits
function toArabicDigits(str) {
  return String(str).replace(/[0-9]/g, function (d) {
    return String.fromCharCode(0x0660 + parseInt(d, 10));
  });
}

// Integer from user input; Arabic-Indic digits are accepted too
function toInt(str, fallback) {
  var s = String(str).replace(/[\u0660-\u0669]/g, function (d) {
    return String(d.charCodeAt(0) - 0x0660);
  }).replace(/[^\d-]/g, '');
  var v = parseInt(s, 10);
  return isNaN(v) ? fallback : v;
}

// Number -> Arabic-Indic string, zero-padded to width
function formatNumber(n, width) {
  var s = String(Math.abs(n));
  while (s.length < width) s = '0' + s;
  return toArabicDigits((n < 0 ? '-' : '') + s);
}

function calcNumbers(start, end, inc, amt) {
  var out = [], i = 0, v;
  if (end === null && inc !== 0) return out;
  if (inc > 0) {
    while (i < amt) {
      v = start + i * inc;
      if (v > end) break;
      out.push(v);
      i++;
    }
  } else if (inc < 0) {
    while (i < amt) {
      v = start + i * inc;
      if (v < end) break;
      out.push(v);
      i++;
    }
  } else {
    while (i < amt) { out.push(start); i++; }
  }
  return out;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// opts: start, end, inc, useAll, shuffle, pad, auto, fixed
// count: how many texts will be numbered. Returns array of Arabic strings.
function buildLabels(opts, count) {
  var end = opts.useAll ? opts.start + (count - 1) * opts.inc : opts.end;
  var nums = calcNumbers(opts.start, end, opts.inc, count);
  if (opts.shuffle) shuffle(nums);

  var width = 1, i;
  if (opts.pad) {
    for (i = 0; i < nums.length; i++) width = Math.max(width, String(Math.abs(nums[i])).length);
    if (!opts.auto) width = Math.max(width, opts.fixed);
  }
  var labels = [];
  for (i = 0; i < nums.length; i++) labels.push(formatNumber(nums[i], width));
  return labels;
}

// Collect text frames from the selection, going into groups
function collectTextFrames(items) {
  var found = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it.typename === 'TextFrame') {
      found.push(it);
    } else if (it.typename === 'GroupItem') {
      found = found.concat(collectTextFrames(it.pageItems));
    }
  }
  return found;
}

// A new line starts when the gap to the line's first item is bigger than tol
function groupLines(sorted, key, tol) {
  var lines = [], cur = [sorted[0]], anchor = key(sorted[0]);
  for (var i = 1; i < sorted.length; i++) {
    if (Math.abs(anchor - key(sorted[i])) <= tol) {
      cur.push(sorted[i]);
    } else {
      lines.push(cur);
      cur = [sorted[i]];
      anchor = key(sorted[i]);
    }
  }
  lines.push(cur);
  return lines;
}

// mode 0: by order in layers (back to front)
// mode 1: by rows    mode 2: by columns    rtl: right to left
function sortFrames(frames, mode, rtl) {
  var list = frames.slice();
  if (mode === 0) return list.reverse();
  if (list.length < 2) return list;

  var i, sum = 0, tol, lines, result = [];
  if (mode === 1) {
    for (i = 0; i < list.length; i++) sum += list[i].height;
    tol = Math.max(1, sum / list.length / 2);
    list.sort(function (a, b) { return b.top - a.top; });
    lines = groupLines(list, function (f) { return f.top; }, tol);
    for (i = 0; i < lines.length; i++) {
      lines[i].sort(function (a, b) { return rtl ? b.left - a.left : a.left - b.left; });
      result = result.concat(lines[i]);
    }
  } else {
    for (i = 0; i < list.length; i++) sum += list[i].width;
    tol = Math.max(1, sum / list.length / 2);
    list.sort(function (a, b) { return a.left - b.left; });
    lines = groupLines(list, function (f) { return f.left; }, tol);
    if (rtl) lines.reverse();
    for (i = 0; i < lines.length; i++) {
      lines[i].sort(function (a, b) { return b.top - a.top; });
      result = result.concat(lines[i]);
    }
  }
  return result;
}

// mode 0: full text   1: numbers in text   2: only {%n} placeholder
function filterFrames(frames, mode) {
  if (mode === 0) return frames.slice();
  var out = [];
  for (var i = 0; i < frames.length; i++) {
    var c = frames[i].contents;
    if (mode === 1 ? HAS_DIGIT.test(c) : c.indexOf(PLACEHOLDER) !== -1) out.push(frames[i]);
  }
  return out;
}

function newContents(oldText, label, mode) {
  if (mode === 1) return oldText.replace(NUMBER_RE, function () { return label; });
  if (mode === 2) return oldText.split(PLACEHOLDER).join(label);
  return label;
}

function shorten(arr) {
  if (arr.length <= 7) return arr;
  return arr.slice(0, 4).concat('...', arr.slice(-2));
}

// ---- helpers end ----

function openURL(url) {
  var f = new File(Folder.temp.absoluteURI + '/arabic_numbering_link.html');
  f.open('w');
  f.write('<html><head><meta http-equiv="refresh" content="0; url=' + url + '"></head><body></body></html>');
  f.close();
  f.execute();
}

function main() {
  if (app.documents.length === 0) {
    alert('Open a document first.');
    return;
  }
  var sel = app.selection;
  var frames = (sel && sel.length) ? collectTextFrames(sel) : [];
  if (frames.length === 0) {
    alert('Select one or more text objects and run the script again.');
    return;
  }
  var isMac = /mac/i.test($.os);

  var win = new Window('dialog', 'Arabic Numbering');
  win.orientation = 'row';
  win.alignChildren = ['fill', 'top'];

  var left = win.add('group');
  left.orientation = 'column';
  left.alignChildren = ['fill', 'top'];

  // ---- Numbers ----
  var numPnl = left.add('panel', undefined, 'Numbers');
  numPnl.alignChildren = 'left';
  numPnl.spacing = 15;
  numPnl.margins = [10, 15, 10, 10];

  var inputs = numPnl.add('group');
  inputs.spacing = 15;

  var startGrp = inputs.add('group');
  startGrp.add('statictext', undefined, 'Start:');
  var startInp = startGrp.add('edittext', undefined, '1');
  startInp.preferredSize.width = 48;

  var endGrp = inputs.add('group');
  endGrp.add('statictext', undefined, 'End:');
  var endInp = endGrp.add('edittext', undefined, '');
  endInp.preferredSize.width = 48;

  var incGrp = inputs.add('group');
  incGrp.add('statictext', undefined, 'Increment:');
  var incInp = incGrp.add('edittext', undefined, '1');
  incInp.preferredSize.width = 48;

  var optWrap = numPnl.add('group');
  optWrap.alignChildren = ['left', 'top'];

  var col1 = optWrap.add('group');
  col1.orientation = 'column';
  col1.alignChildren = 'left';
  var useAllChk = col1.add('checkbox', undefined, 'Number to last text');
  var shuffleChk = col1.add('checkbox', undefined, 'Shuffle numbers order');
  var removeChk = col1.add('checkbox', undefined, 'Remove unused texts');

  var divider = optWrap.add('panel', undefined, undefined);
  divider.alignment = 'fill';

  var col2 = optWrap.add('group');
  col2.orientation = 'column';
  col2.alignChildren = 'left';
  var padChk = col2.add('checkbox', undefined, 'Add leading zeros');
  padChk.helpTip = 'E.g. \u0660\u0661, \u0660\u0662, \u0660\u0660\u0666';
  var autoRad = col2.add('radiobutton', undefined, 'Auto number of digits');
  autoRad.value = true;
  var fixedGrp = col2.add('group');
  var fixedRad = fixedGrp.add('radiobutton', undefined, 'Fixed, no less than:');
  var fixedInp = fixedGrp.add('edittext', undefined, '3');
  fixedInp.characters = 3;

  // ---- Sort + Replace ----
  var lower = left.add('group');
  lower.alignChildren = ['fill', 'top'];

  var sortPnl = lower.add('panel', undefined, 'Sort before numbering');
  sortPnl.alignChildren = 'left';
  sortPnl.margins = [10, 15, 10, 10];
  var layersRad = sortPnl.add('radiobutton', undefined, 'By order in layers');
  var rowsRad = sortPnl.add('radiobutton', undefined, 'By rows (like Z)');
  rowsRad.value = true;
  var colsRad = sortPnl.add('radiobutton', undefined, 'By columns (like \u0418)');
  var rtlChk = sortPnl.add('checkbox', undefined, 'Right to left');

  var rplPnl = lower.add('panel', undefined, 'Replace text to number');
  rplPnl.alignChildren = 'left';
  rplPnl.margins = [10, 15, 10, 10];
  var fullRad = rplPnl.add('radiobutton', undefined, 'Full text content');
  fullRad.value = true;
  var numsRad = rplPnl.add('radiobutton', undefined, 'Numbers in text');
  var phRad = rplPnl.add('radiobutton', undefined, 'Only ' + PLACEHOLDER + ' placeholder');

  // ---- Right column ----
  var right = win.add('group');
  right.orientation = 'column';
  right.alignChildren = ['fill', 'top'];
  right.maximumSize.width = 80;

  var cancelBtn, okBtn;
  if (isMac) {
    cancelBtn = right.add('button', undefined, 'Cancel', { name: 'cancel' });
    okBtn = right.add('button', undefined, 'OK', { name: 'ok' });
  } else {
    okBtn = right.add('button', undefined, 'OK', { name: 'ok' });
    cancelBtn = right.add('button', undefined, 'Cancel', { name: 'cancel' });
  }

  right.add('statictext', undefined, 'Preview');
  var prvw = right.add('statictext', undefined, '', { multiline: true });
  prvw.preferredSize.height = 110;
  var cntTxt = right.add('statictext', undefined, '0 / 0');
  cntTxt.helpTip = 'Numbers / Texts. If the first is smaller, some texts will not be changed';
  var link = right.add('statictext', undefined, 'Visit Github');

  // ---- Logic ----
  function readOpts() {
    return {
      start: toInt(startInp.text, 1),
      end: HAS_DIGIT.test(endInp.text) ? toInt(endInp.text, null) : null,
      inc: toInt(incInp.text, 1),
      useAll: useAllChk.value,
      shuffle: shuffleChk.value,
      pad: padChk.value,
      auto: autoRad.value,
      fixed: Math.max(1, toInt(fixedInp.text, 1))
    };
  }
  function replaceMode() { return fullRad.value ? 0 : (numsRad.value ? 1 : 2); }
  function sortMode() { return layersRad.value ? 0 : (rowsRad.value ? 1 : 2); }

  function update() {
    var count = filterFrames(frames, replaceMode()).length;
    var labels = buildLabels(readOpts(), count);
    prvw.text = shorten(labels).join('\n');
    cntTxt.text = labels.length + ' / ' + count;
  }

  function syncEnabled() {
    endGrp.enabled = !useAllChk.value;
    removeChk.enabled = !useAllChk.value;
    autoRad.enabled = padChk.value;
    fixedGrp.enabled = padChk.value;
    fixedInp.enabled = padChk.value && fixedRad.value;
    rtlChk.enabled = !layersRad.value;
  }

  startInp.onChanging = endInp.onChanging = incInp.onChanging = fixedInp.onChanging = update;
  shuffleChk.onClick = update;
  useAllChk.onClick = function () { syncEnabled(); update(); };
  padChk.onClick = function () { syncEnabled(); update(); };
  autoRad.onClick = function () { fixedRad.value = false; syncEnabled(); update(); };
  fixedRad.onClick = function () { autoRad.value = false; syncEnabled(); update(); };
  layersRad.onClick = rowsRad.onClick = colsRad.onClick = syncEnabled;
  fullRad.onClick = numsRad.onClick = phRad.onClick = update;
  link.addEventListener('mousedown', function () { openURL(GITHUB_URL); });
  cancelBtn.onClick = function () { win.close(); };

  okBtn.onClick = function () {
    var mode = replaceMode();
    var ordered = sortFrames(frames, sortMode(), rtlChk.value);
    var targets = filterFrames(ordered, mode);
    if (targets.length === 0) {
      alert('No texts match the selected "Replace text to number" mode.');
      return;
    }
    var labels = buildLabels(readOpts(), targets.length);
    if (labels.length === 0) {
      alert('No numbers to write.\nEnter an End number or tick "Number to last text".');
      return;
    }
    var failed = 0, i;

    for (i = 0; i < labels.length; i++) {
      try {
        targets[i].contents = newContents(targets[i].contents, labels[i], mode);
      } catch (e) { failed++; }
    }
    if (removeChk.enabled && removeChk.value) {
      for (i = labels.length; i < targets.length; i++) {
        try { targets[i].remove(); } catch (e2) { failed++; }
      }
    }
    win.close();
    if (failed) alert(failed + ' text(s) could not be changed (locked or hidden layer?).');
  };

  syncEnabled();
  update();
  win.center();
  win.show();
}

try {
  main();
} catch (e) {
  alert('Arabic Numbering error:\n' + e.message);
}
