import React, { useMemo, useState, useEffect } from 'react'

/**
 * 酒精大富翁｜Alcohol Monopoly (local hot‑seat)
 * -------------------------------------------------------------
 * 單檔 React 版本，可直接貼到 Vite 的 src/App.jsx 取代內容執行。
 * 特色：
 * - 支援 2–8 名玩家（同機輪流操作）
 * - 骰子移動、抽「機會/命運」卡、喝酒／加公杯、暫停一回合、移動到指定格等
 * - 公杯機制（中心累積，踩到或抽到時喝）
 * - 可編輯卡片與地圖（UI 內即可新增/刪除/重洗）
 * - 自動存檔（localStorage）
 * - 行為日誌（可匯出 JSON）
 *
 * 建議搭配規則：依你們的家規微調卡片與格子效果；
 * 內建的中文文案為示意，請自行替換。
 */

/***** 型別註解（僅注釋協助閱讀） *****
 * Tile = { id, type, label, color?, amount?, move?, goto?, skipTurns?, addToCup?, takeFromCup? }
 * type: 'start' | 'drink' | 'chance' | 'destiny' | 'public' | 'rest' | 'jump' | 'paycup' | 'takecup' | 'custom'
 * Card = { id, deck: 'chance'|'destiny', text, effect }
 */

// ---- 工具 ----
const uid = () => Math.random().toString(36).slice(2, 9)
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

// ---- 遊戲預設參數 ----
const DEFAULT_UNIT = '口' // 你們喝的單位（口／秒／ml／小罰杯）

const DEFAULT_TILES = [
  { id: uid(), type: 'start', label: 'START' },
  { id: uid(), type: 'drink', label: '暖身一口', amount: 1, color: 'bg-indigo-100' },
  { id: uid(), type: 'chance', label: '機會卡', color: 'bg-sky-200' },
  { id: uid(), type: 'drink', label: '我最會喝', amount: 2, color: 'bg-indigo-100' },
  { id: uid(), type: 'jump', label: '最猛英雄 → +2 步', move: 2, color: 'bg-violet-100' },
  { id: uid(), type: 'destiny', label: '命運卡', color: 'bg-pink-200' },
  { id: uid(), type: 'drink', label: '乾杯', amount: 2, color: 'bg-indigo-100' },
  { id: uid(), type: 'paycup', label: '加到公杯 2 口', addToCup: 2, color: 'bg-amber-100' },
  { id: uid(), type: 'rest', label: '休息一回合', skipTurns: 1, color: 'bg-emerald-100' },
  { id: uid(), type: 'chance', label: '機會卡', color: 'bg-sky-200' },
  { id: uid(), type: 'drink', label: '同桌最帥喝', amount: 1, color: 'bg-indigo-100' },
  { id: uid(), type: 'public', label: 'SHOT 公杯', takeFromCup: true, color: 'bg-yellow-200' },
  { id: uid(), type: 'destiny', label: '命運卡', color: 'bg-pink-200' },
  { id: uid(), type: 'paycup', label: '加到公杯 3 口', addToCup: 3, color: 'bg-amber-100' },
  { id: uid(), type: 'drink', label: '全場乾杯', amount: 1, color: 'bg-indigo-100' },
  { id: uid(), type: 'chance', label: '機會卡', color: 'bg-sky-200' },
  { id: uid(), type: 'jump', label: '退回 2 步', move: -2, color: 'bg-violet-100' },
  { id: uid(), type: 'drink', label: '指定 1 人喝 2 口', amount: 2, color: 'bg-indigo-100' },
  { id: uid(), type: 'destiny', label: '命運卡', color: 'bg-pink-200' },
  { id: uid(), type: 'drink', label: '自己喝 1 口', amount: 1, color: 'bg-indigo-100' },
  { id: uid(), type: 'chance', label: '機會卡', color: 'bg-sky-200' },
  { id: uid(), type: 'rest', label: '休息一回合', skipTurns: 1, color: 'bg-emerald-100' },
  { id: uid(), type: 'paycup', label: '加到公杯 1 口', addToCup: 1, color: 'bg-amber-100' },
]

const SAMPLE_CHANCE = [
  { id: uid(), deck: 'chance', text: '你是今晚的盲測王，自己喝 2 口。', effect: p => ({ selfDrink: 2 }) },
  { id: uid(), deck: 'chance', text: '骰到偶數者喝 2 口（若都不是，發卡者喝 1 口）。', effect: (p, roll) => ({ groupRollEvenDrink: 2 }) },
  { id: uid(), deck: 'chance', text: '將 2 口加入公杯。', effect: () => ({ addCup: 2 }) },
  { id: uid(), deck: 'chance', text: '和任一玩家交換位置。', effect: () => ({ swapWithSomeone: true }) },
]

const SAMPLE_DESTINY = [
  { id: uid(), deck: 'destiny', text: '倒楣！退回 3 格並喝 1 口。', effect: () => ({ move: -3, selfDrink: 1 }) },
  { id: uid(), deck: 'destiny', text: '幸運！前進 4 格，指定 1 人喝 2 口。', effect: () => ({ move: 4, targetDrink: 2 }) },
  { id: uid(), deck: 'destiny', text: '公杯炸彈：喝掉公杯全部。', effect: () => ({ takeCupAll: true }) },
  { id: uid(), deck: 'destiny', text: '暫停一回合。', effect: () => ({ skip: 1 }) },
]

// ---- 儲存、載入 ----
const STORAGE_KEY = 'alcohol-monopoly-state-v1'
const loadState = () => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') } catch { return null }
}
const saveState = (s) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { }
}

// ---- Board helpers：把索引轉 9x9 外框座標（只用外框 9*4-4=32 格；不夠會自動縮小） ----
function edgePathCoords(n) {
  const size = 9 // 9x9 外框
  const perSide = size - 1 // 8
  const total = perSide * 4 // 32
  const idx = ((n % total) + total) % total
  const side = Math.floor(idx / perSide)
  const offset = idx % perSide
  let r = 0, c = 0
  if (side === 0) { r = size - 1; c = offset } // 下到右
  else if (side === 1) { r = size - 1 - offset; c = size - 1 } // 右到上
  else if (side === 2) { r = 0; c = size - 1 - offset } // 上到左
  else { r = offset; c = 0 } // 左到下
  return { r, c, size, total }
}

// ---- 元件 ----
function Dice({ value }) {
  return (
    <div className="size-12 rounded-2xl shadow flex items-center justify-center text-2xl font-bold bg-white">
      {value}
    </div>
  )
}

function PlayerBadge({ p, isTurn }) {
  return (
    <div className={`px-3 py-2 rounded-2xl shadow flex items-center gap-2 ${isTurn ? 'bg-black text-white' : 'bg-white'}`}>
      <div className="size-5 rounded-full" style={{ background: p.color }} />
      <div className="font-medium">{p.name}</div>
      <div className="text-xs opacity-70">格 {p.pos}</div>
      {p.skip > 0 && <div className="text-[11px] bg-yellow-200 rounded px-2">暫停 {p.skip}</div>}
    </div>
  )
}

function TileView({ t, index, unit }) {
  const base = `rounded-xl p-2 text-xs select-none ${t.color || 'bg-slate-100'} border border-slate-200`;
  return (
    <div className={base}>
      <div className="text-[10px] uppercase tracking-wide opacity-60">{t.type}</div>
      <div className="font-semibold leading-tight">{t.label}</div>
      {t.type === 'drink' && <div className="text-[11px] opacity-70">喝 {t.amount}{unit}</div>}
      {t.addToCup && <div className="text-[11px] opacity-70">公杯 +{t.addToCup}{unit}</div>}
    </div>
  )
}

function Modal({ open, onClose, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl p-5 w-full max-w-lg" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export default function App() {
  // ---- 初始化 ----
  const [unit, setUnit] = useState(DEFAULT_UNIT)
  const [tiles, setTiles] = useState(DEFAULT_TILES)
  const [chance, setChance] = useState(SAMPLE_CHANCE)
  const [destiny, setDestiny] = useState(SAMPLE_DESTINY)
  const [cup, setCup] = useState(0)
  const [players, setPlayers] = useState([
    { id: uid(), name: '玩家A', color: '#ef4444', pos: 0, skip: 0 },
    { id: uid(), name: '玩家B', color: '#3b82f6', pos: 0, skip: 0 },
  ])
  const [turn, setTurn] = useState(0)
  const [dice, setDice] = useState(1)
  const [log, setLog] = useState([])
  const [cardModal, setCardModal] = useState(null) // { deck, text }
  const [editOpen, setEditOpen] = useState(false)

  // 載入存檔
  useEffect(() => {
    const s = loadState()
    if (s) {
      setUnit(s.unit || DEFAULT_UNIT)
      setTiles(s.tiles || DEFAULT_TILES)
      setChance(s.chance || SAMPLE_CHANCE)
      setDestiny(s.destiny || SAMPLE_DESTINY)
      setCup(s.cup || 0)
      setPlayers(s.players || players)
      setTurn(clamp(s.turn || 0, 0, (s.players || players).length - 1))
      setLog(s.log || [])
    }
    // eslint-disable-next-line
  }, [])

  // 自動存檔
  useEffect(() => {
    saveState({ unit, tiles, chance, destiny, cup, players, turn, log })
  }, [unit, tiles, chance, destiny, cup, players, turn, log])

  const current = players[turn]

  // ---- 遊戲核心 ----
  const appendLog = (txt) => setLog(l => [{ id: uid(), t: Date.now(), txt }, ...l].slice(0, 300))

  function nextTurn() {
    setTurn(t => (t + 1) % players.length)
  }

  function movePlayer(pid, steps) {
    setPlayers(ps => ps.map(p => p.id === pid ? { ...p, pos: (p.pos + steps + tiles.length) % tiles.length } : p))
  }

  function applyDrink(targetIndex, amount, reason = '喝酒') {
    if (amount <= 0) return
    const p = players[targetIndex]
    appendLog(`${p.name} ${reason}：${amount}${unit}`)
  }

  function handleTile(p) {
    const t = tiles[p.pos]
    if (!t) return

    switch (t.type) {
      case 'start':
        appendLog(`${p.name} 抵達 START`)
        break
      case 'drink':
        applyDrink(turn, t.amount, t.label)
        break
      case 'chance':
        drawCard('chance')
        break
      case 'destiny':
        drawCard('destiny')
        break
      case 'public':
        if (cup > 0) { applyDrink(turn, cup, '公杯'); setCup(0) } else { appendLog('公杯目前是 0') }
        break
      case 'rest':
        setPlayers(ps => ps.map(x => x.id === p.id ? { ...x, skip: (x.skip || 0) + (t.skipTurns || 1) } : x))
        appendLog(`${p.name} 將暫停 ${t.skipTurns || 1} 回合`)
        break
      case 'jump':
        appendLog(`${p.name} 觸發跳躍：${t.move > 0 ? '+' : ''}${t.move} 格`)
        movePlayer(p.id, t.move)
        break
      case 'paycup':
        setCup(c => c + (t.addToCup || 0))
        appendLog(`${p.name} 將 ${t.addToCup || 0}${unit} 加入公杯（現有 ${cup + (t.addToCup || 0)}${unit}）`)
        break
      case 'takecup':
        if (cup > 0) { applyDrink(turn, cup, '拿公杯'); setCup(0) } else { appendLog('公杯目前是 0') }
        break
      default:
        break
    }
  }

  function drawCard(deck) {
    const setDeck = deck === 'chance' ? setChance : setDestiny
    const getDeck = deck === 'chance' ? chance : destiny
    if (getDeck.length === 0) return appendLog(`${deck === 'chance' ? '機會' : '命運'}卡已抽完，請在設定重洗。`)
    const [card, ...rest] = getDeck
    setDeck(rest.concat([card])) // 轉到牌底（循環抽）
    setCardModal({ deck, text: card.text })
    resolveCardEffect(card)
  }

  function resolveCardEffect(card) {
    const p = players[turn]
    const eff = typeof card.effect === 'function' ? card.effect(p, dice) : card.effect
    if (!eff) return

    if (eff.move) { movePlayer(p.id, eff.move); appendLog(`${p.name} 依卡片移動 ${eff.move > 0 ? '+' : ''}${eff.move} 格`) }
    if (eff.selfDrink) { applyDrink(turn, eff.selfDrink, '卡片效果') }
    if (eff.targetDrink) { // UI 簡化：給下一位
      const target = (turn + 1) % players.length
      applyDrink(target, eff.targetDrink, `${p.name} 指定`)
    }
    if (eff.addCup) { setCup(c => c + eff.addCup); appendLog(`公杯 +${eff.addCup}${unit}`) }
    if (eff.takeCupAll) { if (cup > 0) { applyDrink(turn, cup, '公杯'); setCup(0) } else appendLog('公杯為 0') }
    if (eff.swapWithSomeone) {
      // 和下一位交換位置（簡化）
      setPlayers(ps => {
        const a = turn, b = (turn + 1) % ps.length
        const A = ps[a], B = ps[b]
        const tmpA = { ...A, pos: B.pos }
        const tmpB = { ...B, pos: A.pos }
        const copy = [...ps]
        copy[a] = tmpA; copy[b] = tmpB
        return copy
      })
      appendLog(`${p.name} 與下一位玩家交換位置`)
    }
    if (eff.skip) { setPlayers(ps => ps.map(x => x.id === p.id ? { ...x, skip: (x.skip || 0) + eff.skip } : x)); appendLog(`${p.name} 將暫停 ${eff.skip} 回合`) }
    if (eff.groupRollEvenDrink) { appendLog(`所有骰到偶數者喝 ${eff.groupRollEvenDrink}${unit}（口頭結算）`) }
  }

  function rollDice() {
    if (players.some(p => !p.name || !p.color)) return
    const cur = players[turn]
    if (cur.skip > 0) {
      appendLog(`${cur.name} 跳過回合（剩 ${cur.skip - 1}）`)
      setPlayers(ps => ps.map(x => x.id === cur.id ? { ...x, skip: x.skip - 1 } : x))
      return nextTurn()
    }
    const v = Math.floor(Math.random() * 6) + 1
    setDice(v)
    appendLog(`${cur.name} 擲出 ${v}`)
    movePlayer(cur.id, v)
    setTimeout(() => { handleTile({ ...cur, pos: (cur.pos + v) % tiles.length }) }, 50)
  }

  // ---- UI：板塊座標 ----
  const coords = useMemo(() => tiles.map((_, i) => edgePathCoords(i)), [tiles])

  // ---- 設定對話框 ----
  function Settings() {
    const [localPlayers, setLocalPlayers] = useState(players)
    const [localTiles, setLocalTiles] = useState(tiles)
    const [localChance, setLocalChance] = useState(chance)
    const [localDestiny, setLocalDestiny] = useState(destiny)
    const [localUnit, setLocalUnit] = useState(unit)

    return (
      <Modal open={editOpen} onClose={() => setEditOpen(false)}>
        <div className="space-y-4">
          <div className="text-xl font-bold">遊戲設定</div>

          {/* 玩家 */}
          <div className="space-y-2">
            <div className="font-semibold">玩家（2–8 人）</div>
            <div className="grid gap-2">
              {localPlayers.map((p, idx) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input className="input" value={p.name} onChange={e => {
                    const v = e.target.value; setLocalPlayers(ps => ps.map(x => x.id === p.id ? { ...x, name: v } : x))
                  }} />
                  <input type="color" value={p.color} onChange={e => {
                    const v = e.target.value; setLocalPlayers(ps => ps.map(x => x.id === p.id ? { ...x, color: v } : x))
                  }} />
                  <button className="btn" onClick={() => setLocalPlayers(ps => ps.filter(x => x.id !== p.id))}>刪除</button>
                </div>
              ))}
              <div className="flex gap-2">
                <button className="btn" onClick={() => setLocalPlayers(ps => ps.length < 8 ? [...ps, { id: uid(), name: `玩家${ps.length + 1}`, color: '#22c55e', pos: 0, skip: 0 }] : ps)}>新增玩家</button>
              </div>
            </div>
          </div>

          {/* 單位、牌組 */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="font-semibold">飲用單位</div>
              <input className="input" value={localUnit} onChange={e => setLocalUnit(e.target.value)} />
              <div className="text-xs opacity-60">例如：口 / 秒 / ml / 罰杯</div>
            </div>
            <div className="space-y-2">
              <div className="font-semibold">公杯目前：{cup}{unit}</div>
              <button className="btn" onClick={() => setCup(0)}>清空公杯</button>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <DeckEditor title="機會卡" deck={localChance} setDeck={setLocalChance} />
            <DeckEditor title="命運卡" deck={localDestiny} setDeck={setLocalDestiny} />
          </div>

          <div className="space-y-2">
            <div className="font-semibold">格子（循環路徑）</div>
            <div className="grid gap-2">
              {localTiles.map((t, idx) => (
                <div key={t.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2 text-xs opacity-70">#{idx}</div>
                  <select className="input col-span-2" value={t.type} onChange={e => {
                    const v = e.target.value; setLocalTiles(ts => ts.map(x => x.id === t.id ? { ...x, type: v } : x))
                  }}>
                    {['start', 'drink', 'chance', 'destiny', 'public', 'rest', 'jump', 'paycup', 'takecup', 'custom'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input className="input col-span-4" value={t.label} onChange={e => {
                    const v = e.target.value; setLocalTiles(ts => ts.map(x => x.id === t.id ? { ...x, label: v } : x))
                  }} />
                  <input className="input col-span-2" placeholder="數值" value={t.amount || t.addToCup || t.move || ''} onChange={e => {
                    const v = Number(e.target.value || 0); setLocalTiles(ts => ts.map(x => x.id === t.id ? { ...x, amount: (x.type === 'drink' ? v : undefined), addToCup: (x.type === 'paycup' ? v : undefined), move: (x.type === 'jump' ? v : undefined) } : x))
                  }} />
                  <button className="btn col-span-2" onClick={() => setLocalTiles(ts => ts.filter(x => x.id !== t.id))}>刪除</button>
                </div>
              ))}
              <button className="btn" onClick={() => setLocalTiles(ts => [...ts, { id: uid(), type: 'drink', label: '喝 1 口', amount: 1 }])}>新增格子</button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button className="btn" onClick={() => {
              setEditOpen(false)
            }}>取消</button>
            <button className="btn btn-primary" onClick={() => {
              setPlayers(localPlayers.map(p => ({ ...p, pos: 0, skip: 0 })))
              setTiles(localTiles)
              setChance(localChance)
              setDestiny(localDestiny)
              setUnit(localUnit)
              setTurn(0)
              appendLog('已套用設定並重置玩家位置。')
              setEditOpen(false)
            }}>套用</button>
          </div>
        </div>
      </Modal>
    )
  }

  function DeckEditor({ title, deck, setDeck }) {
    const [text, setText] = useState('')
    return (
      <div>
        <div className="font-semibold mb-2">{title}（{deck.length} 張）</div>
        <div className="space-y-2">
          {deck.map((c, i) => (
            <div key={c.id} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-1 text-xs opacity-60">#{i + 1}</div>
              <textarea className="input col-span-9" value={c.text} onChange={e => setDeck(ds => ds.map(x => x.id === c.id ? { ...x, text: e.target.value } : x))} />
              <button className="btn col-span-2" onClick={() => setDeck(ds => ds.filter(x => x.id !== c.id))}>刪除</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="輸入卡片文字..." value={text} onChange={e => setText(e.target.value)} />
            <button className="btn" onClick={() => { if (!text.trim()) return; setDeck(ds => [...ds, { id: uid(), deck: title.includes('機會') ? 'chance' : 'destiny', text, effect: { selfDrink: 1 } }]); setText('') }}>新增</button>
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setDeck(ds => [...ds.slice(1), ds[0]])}>切牌（頂→底）</button>
            <button className="btn" onClick={() => setDeck(ds => ds.toSorted(() => Math.random() - 0.5))}>重洗</button>
          </div>
        </div>
      </div>
    )
  }

  // ---- 畫面 ----
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-8">
      <Settings />
      <Modal open={!!cardModal} onClose={() => setCardModal(null)}>
        <div className="space-y-3">
          <div className="text-sm uppercase tracking-widest opacity-60">{cardModal?.deck === 'chance' ? 'CARDS OF CHANCE' : 'CARDS OF DESTINY'}</div>
          <div className="text-lg font-bold leading-snug">{cardModal?.text}</div>
          <button className="btn btn-primary" onClick={() => setCardModal(null)}>好的</button>
        </div>
      </Modal>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-2xl md:text-3xl font-black">酒精大富翁 <span className="text-slate-500 text-base font-medium">Alcohol Monopoly</span></div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setEditOpen(true)}>設定/自訂內容</button>
          <button className="btn" onClick={() => { localStorage.removeItem(STORAGE_KEY); location.reload() }}>清除存檔</button>
        </div>
      </div>

      {/* Players */}
      <div className="mt-4 flex flex-wrap gap-2">
        {players.map((p, i) => <PlayerBadge key={p.id} p={p} isTurn={i === turn} />)}
      </div>

      {/* Board + Control */}
      <div className="mt-6 grid lg:grid-cols-[1fr_520px] gap-6">
        {/* Board */}
        <div className="bg-white rounded-3xl shadow p-4">
          <div className="grid grid-cols-9 grid-rows-9 gap-2">
            {Array.from({ length: 81 }).map((_, i) => {
              const r = Math.floor(i / 9), c = i % 9
              const tileIndex = coords.findIndex(co => co.r === r && co.c === c)
              const isEdge = r === 0 || r === 8 || c === 0 || c === 8
              const content = tileIndex > -1 && tiles[tileIndex]
              return (
                <div key={i} className={`relative aspect-square ${isEdge ? '' : 'opacity-0'} `}>
                  {content && <TileView t={content} index={tileIndex} unit={unit} />}
                  {/* 玩家圓點 */}
                  <div className="absolute inset-0 flex flex-wrap items-start content-start gap-1 p-1">
                    {players.filter(p => p.pos === tileIndex).map(p => (
                      <div key={p.id} className="size-3 rounded-full ring-2 ring-white" title={p.name} style={{ background: p.color }} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Control Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-3xl shadow p-5">
            <div className="flex items-center justify-between">
              <div className="text-lg font-bold">當前玩家：{current?.name}</div>
              <Dice value={dice} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="btn btn-primary" onClick={rollDice}>擲骰子並前進</button>
              <button className="btn" onClick={() => { handleTile(current) }}>重觸發目前格子</button>
              <button className="btn" onClick={() => { nextTurn() }}>直接結束回合</button>
              <button className="btn" onClick={() => { setCup(c => c + 1); appendLog('手動：公杯+1') }}>公杯 +1{unit}</button>
            </div>
            <div className="mt-3 text-sm opacity-70">公杯現有：<span className="font-semibold">{cup}{unit}</span></div>
          </div>

          <div className="bg-white rounded-3xl shadow p-5">
            <div className="text-lg font-bold mb-2">行為日誌</div>
            <div className="max-h-72 overflow-auto space-y-1 text-sm">
              {log.length === 0 && <div className="opacity-50">暫無紀錄</div>}
              {log.map(x => <div key={x.id}>• {x.txt}</div>)}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn" onClick={() => setLog([])}>清空</button>
              <button className="btn" onClick={() => {
                const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'alcohol-monopoly-log.json'; a.click(); URL.revokeObjectURL(url)
              }}>匯出 JSON</button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-xs opacity-60">
        遊戲僅供朋友聚會娛樂，請理性飲酒、未成年請勿飲酒。
      </div>

      {/* 基礎樣式（Tailwind 公用風格）*/}
      <style>{`
        .btn{ @apply px-3 py-2 rounded-2xl border border-slate-300 bg-white shadow-sm text-sm; }
        .btn:hover{ @apply -translate-y-px shadow; }
        .btn:active{ @apply translate-y-px; }
        .btn-primary{ @apply bg-black text-white border-black; }
        .input{ @apply px-3 py-2 rounded-xl border border-slate-300 bg-white text-sm w-full; }
      `}</style>
    </div>
  )
}
