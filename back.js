let state = { cash: 21566, gcash: 43572, log: [] };
let type = 'CASH IN';
let note = 'ACTUAL';
let displayLimit = 20;
let editingIndex = null;
let deleteIndex = null;

function setStatus(msg, isError) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.style.color = isError ? '#a3341f' : '#7a7a74';
}

function load() {
  try {
    const raw = localStorage.getItem('tracker-data');
    if (raw) state = JSON.parse(raw);
    setStatus('');
  } catch (e) {
    setStatus('Could not load saved data: ' + e, true);
  }
  render();
}

function save() {
  try {
    localStorage.setItem('tracker-data', JSON.stringify(state));
    setStatus('Saved just now');
    setTimeout(() => { if (document.getElementById('status').textContent === 'Saved just now') setStatus(''); }, 2000);
    return true;
  } catch (e) {
    setStatus('Save failed: ' + e, true);
    return false;
  }
}

function peso(n) {
  n = Math.round(n);
  return '₱' + n.toLocaleString();
}

function render() {
  document.getElementById('cashVal').textContent = peso(state.cash);
  document.getElementById('gcashVal').textContent = peso(state.gcash);

  const logEl = document.getElementById('log');
  const statsEl = document.getElementById('stats');
  const totalProfit = state.log.reduce((s, t) => s + t.profit, 0);
  statsEl.innerHTML = `<span>${state.log.length} transactions</span><span>${peso(totalProfit)} total profit</span>`;

  const cashInTx = state.log.filter(t => t.type === 'CASH IN');
  const cashOutTx = state.log.filter(t => t.type === 'CASH OUT');
  const sum = (arr, key) => arr.reduce((s, t) => s + t[key], 0);
  document.getElementById('summary').innerHTML = `
    <div class="summary-grid">
      <div class="summary-box in">
        <div class="stitle">Cash in</div>
        <div class="srow"><span>Transactions</span><b>${cashInTx.length}</b></div>
        <div class="srow"><span>Total amount</span><b>${peso(sum(cashInTx, 'amount'))}</b></div>
        <div class="srow"><span>Profit</span><b>${peso(sum(cashInTx, 'profit'))}</b></div>
      </div>
      <div class="summary-box out">
        <div class="stitle">Cash out</div>
        <div class="srow"><span>Transactions</span><b>${cashOutTx.length}</b></div>
        <div class="srow"><span>Total amount</span><b>${peso(sum(cashOutTx, 'amount'))}</b></div>
        <div class="srow"><span>Profit</span><b>${peso(sum(cashOutTx, 'profit'))}</b></div>
      </div>
    </div>`;

  if (state.log.length === 0) {
    logEl.innerHTML = '<div class="empty">No transactions yet</div>';
    document.getElementById('showMoreBtn').style.display = 'none';
    return;
  }
  const reversed = state.log.slice().reverse();
  const visible = reversed.slice(0, displayLimit);
  logEl.innerHTML = visible.map((t, i) => {
    const realIdx = state.log.length - 1 - i;
    return `<div class="log-item">
      <div class="log-left">
        <span class="tag ${t.type === 'CASH IN' ? 'in' : 'out'}">${t.type}</span>
        <span class="tag note">${t.note}</span>
        ${t.notes ? `<div class="log-notes">${escapeHtml(t.notes)}</div>` : ''}
      </div>
      <div class="log-right">
        <div class="amt">${peso(t.amount)}</div>
        <div>profit ${peso(t.profit)}</div>
        <button class="edit" data-idx="${realIdx}">edit</button>
        <button class="del" data-idx="${realIdx}">delete</button>
      </div>
    </div>`;
  }).join('');

  logEl.querySelectorAll('.edit').forEach(btn => {
    btn.addEventListener('click', () => editTx(parseInt(btn.dataset.idx)));
  });
  logEl.querySelectorAll('.del').forEach(btn => {
    btn.addEventListener('click', () => deleteTx(parseInt(btn.dataset.idx)));
  });

  const moreBtn = document.getElementById('showMoreBtn');
  const remaining = reversed.length - visible.length;
  if (remaining > 0) {
    moreBtn.style.display = 'block';
    moreBtn.textContent = `Show ${Math.min(remaining, 20)} more (${remaining} left)`;
  } else {
    moreBtn.style.display = 'none';
  }
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function deleteTx(idx){

    deleteIndex = idx;

    document
        .getElementById("deleteModal")
        .classList
        .add("show");

}

function editTx(idx) {
  const t = state.log[idx];
  type = t.type;
  note = t.note;
  setActive('typeSeg', type);
  setActive('noteSeg', note);
  document.getElementById('amountInput').value = t.amount;
  document.getElementById('notesInput').value = t.notes || '';
  editingIndex = idx;
  document.getElementById('addBtn').textContent = 'Update transaction';
  document.getElementById('cancelEditBtn').style.display = 'block';
  document.getElementById('amountInput').focus();
  document.getElementById('amountInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelEdit() {
  editingIndex = null;
  document.getElementById('addBtn').textContent = 'Add transaction';
  document.getElementById('cancelEditBtn').style.display = 'none';
  document.getElementById('amountInput').value = '';
  document.getElementById('notesInput').value = '';
}

function setActive(segId, val) {
  document.querySelectorAll(`#${segId} button`).forEach(b => {
    b.classList.toggle('active', b.dataset.val === val);
  });
}

document.getElementById('typeSeg').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  type = e.target.dataset.val;
  setActive('typeSeg', type);
});
document.getElementById('noteSeg').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') return;
  note = e.target.dataset.val;
  setActive('noteSeg', note);
});

document.getElementById('addBtn').addEventListener('click', async () => {
  const amtEl = document.getElementById('amountInput');
  const amount = parseFloat(amtEl.value);
  if (!amount || amount <= 0) { amtEl.focus(); return; }
  const profit = amount < 100 ? 5 : Math.ceil(amount / 1000) * 10;
  const amountIn = amount + profit;

  let cashDelta, gcashDelta;
  if (type === 'CASH OUT') {
    if (note === 'ACTUAL') {
      cashDelta = profit - amount;
      gcashDelta = amount;
    } else {
      cashDelta = -amount;
      gcashDelta = amountIn;
    }
  } else {
    cashDelta = amountIn;
    gcashDelta = note === 'ACTUAL' ? -amount : amountIn;
  }

  if (editingIndex !== null) {
    const old = state.log[editingIndex];
    state.cash = state.cash - old.cashDelta + cashDelta;
    state.gcash = state.gcash - old.gcashDelta + gcashDelta;
    state.log[editingIndex] = {
      type, amount, profit, note,
      notes: document.getElementById('notesInput').value.trim(),
      cashDelta, gcashDelta,
      ts: old.ts
    };
    cancelEdit();
  } else {
    state.cash += cashDelta;
    state.gcash += gcashDelta;
    state.log.push({
      type, amount, profit, note,
      notes: document.getElementById('notesInput').value.trim(),
      cashDelta, gcashDelta,
      ts: Date.now()
    });
    amtEl.value = '';
    document.getElementById('notesInput').value = '';
  }

  render();
  save();
});

document.getElementById('cancelEditBtn').addEventListener('click', cancelEdit);

document.getElementById('showMoreBtn').addEventListener('click', () => {
  displayLimit += 20;
  render();
});

function makeEditable(cardId, key) {
  document.getElementById(cardId).addEventListener('click', () => {
    const card = document.getElementById(cardId);
    if (card.querySelector('input')) return;
    const valEl = card.querySelector('.value');
    const current = state[key];
    valEl.innerHTML = `<input type="number" value="${current}">`;
    const input = valEl.querySelector('input');
    input.focus();
    input.select();
    const commit = async () => {
      const v = parseFloat(input.value);
      if (!isNaN(v)) { state[key] = v; save(); }
      render();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
  });
}
makeEditable('cashCard', 'cash');
makeEditable('gcashCard', 'gcash');

setActive('typeSeg', type);
setActive('noteSeg', note);
load();

document
.getElementById("cancelDelete")
.onclick = function(){

    deleteIndex = null;

    document
        .getElementById("deleteModal")
        .classList
        .remove("show");

};


document
.getElementById("confirmDelete")
.onclick = function(){

    if(deleteIndex===null) return;

    if(editingIndex===deleteIndex){
        cancelEdit();
    }

    const t = state.log[deleteIndex];

    state.cash -= t.cashDelta;
    state.gcash -= t.gcashDelta;

    state.log.splice(deleteIndex,1);

    deleteIndex = null;

    save();

    render();

    document
        .getElementById("deleteModal")
        .classList
        .remove("show");

};