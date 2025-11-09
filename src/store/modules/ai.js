import * as engine from '@/ai/engine'
import { RENJU, CONFIGS } from './settings'

const state = {
  fullEngine: true,
  loadingProgress: 0.0,
  ready: false,
  startSize: 0,
  restart: false,
  thinking: false,
  timeUsed: 0,
  lastThinkTime: 0,
  lastThinkPosition: [],
  currentConfig: null,
  hashSize: null,
  thinkingTimeout: null,
  thinkingStartTime: 0,
  engineError: false,
  engineErrorShown: false,
  posCallback: null,
  outputs: {
    pos: null,
    swap: null,
    currentPV: 0,
    pv: [
      {
        depth: 0,
        seldepth: 0,
        nodes: 0,
        eval: '-',
        winrate: 0.0,
        bestline: [],
      },
    ],
    nodes: 0,
    speed: 0,
    time: 0,
    msg: null,
    realtime: {
      best: [],
      lost: [],
    },
    forbid: [],
    error: null,
  },
  messages: [],
}

const getters = {
  bestlineStr: (state) => (pvIdx) => {
    if (!pvIdx) pvIdx = 0
    let posStrs = []
    for (let p of state.outputs.pv[pvIdx].bestline) {
      const coordX = String.fromCharCode('A'.charCodeAt(0) + p[0])
      const coordY = (state.startSize - p[1]).toString()
      posStrs.push(coordX + coordY)
    }
    return posStrs.join(' ')
  },
}

const mutations = {
  setFullEngine(state, fullEngine) {
    state.fullEngine = fullEngine
  },
  setLoadingProgress(state, progress) {
    state.loadingProgress = progress
  },
  setReady(state, ready) {
    state.ready = ready
  },
  setThinkingState(state, thinking) {
    state.thinking = thinking
  },
  setStartSize(state, size) {
    state.startSize = size
  },
  setRestart(state, enabled = true) {
    state.restart = enabled
  },
  clearUsedTime(state) {
    state.timeUsed = 0
  },
  addUsedTime(state) {
    state.timeUsed += Date.now() - state.lastThinkTime
  },
  setThinkStartTime(state) {
    state.lastThinkTime = Date.now()
  },
  setCurrentConfig(state, config) {
    state.currentConfig = config
  },
  setHashSize(state, hashSize) {
    state.hashSize = hashSize
  },
  addMessage(state, msg) {
    state.messages.push(msg)
  },
  clearMessage(state) {
    state.messages = []
  },
  setOutput(state, output) {
    state.outputs[output.key] = output.value
  },
  setCurrentPV(state, pvIdx) {
    state.outputs.currentPV = pvIdx
  },
  setPVOutput(state, output) {
    let pv = state.outputs.pv[state.outputs.currentPV]
    if (!pv) {
      state.outputs.pv[state.outputs.currentPV] = {}
      pv = state.outputs.pv[state.outputs.currentPV]
    }
    pv[output.key] = output.value
  },
  clearOutput(state) {
    state.outputs.pv = [
      {
        depth: 0,
        seldepth: 0,
        nodes: 0,
        eval: '-',
        winrate: 0.0,
        bestline: [],
      },
    ]
    state.outputs.pos = null
    state.outputs.nodes = 0
    state.outputs.speed = 0
    // Don't clear forbid - forbid marks should persist until board state changes
    // state.outputs.forbid = []
    // Clear realtime moves when clearing output
    state.outputs.realtime.best = []
    state.outputs.realtime.lost = []
  },
  addRealtime(state, rt) {
    state.outputs.realtime[rt.type].push(rt.pos)
  },
  clearRealtime(state, type) {
    // Use Vue.set or direct assignment to ensure reactivity
    if (type === 'best') {
      state.outputs.realtime.best = []
    } else if (type === 'lost') {
      state.outputs.realtime.lost = []
    } else {
      state.outputs.realtime[type] = []
    }
  },
  setPosCallback(state, callback) {
    state.posCallback = callback
  },
  sortPV(state) {
    let isPosEqual = (m) =>
      state.outputs.pos ? m[0] == state.outputs.pos[0] && m[1] == state.outputs.pos[1] : false
    let evalStrToEval = (e) => {
      let val = +e
      if (isNaN(val)) {
        if (e.startsWith('+M')) val = 40000 - +e.substring(2)
        else if (e.startsWith('-M')) val = -40000 + +e.substring(2)
        else val = -80000
      }
      return val
    }

    state.outputs.pv.sort((a, b) => {
      if (isPosEqual(a.bestline[0])) return -1
      else if (isPosEqual(b.bestline[0])) return 1
      return evalStrToEval(b.eval) - evalStrToEval(a.eval)
    })
  },
  setLastThinkPosition(state, position) {
    state.lastThinkPosition = [...position]
  },
  setThinkingTimeout(state, timeout) {
    state.thinkingTimeout = timeout
  },
  clearThinkingTimeout(state) {
    if (state.thinkingTimeout) {
      clearTimeout(state.thinkingTimeout)
      state.thinkingTimeout = null
    }
  },
  setThinkingStartTime(state, time) {
    state.thinkingStartTime = time
  },
  setEngineError(state, value) {
    state.engineError = value
  },
  setEngineErrorShown(state, value) {
    state.engineErrorShown = value
  },
}

const actions = {
  async initEngine({ commit, dispatch, state, rootState, rootGetters }, loadFullEngine) {
    commit('setLoadingProgress', 0.0)
    commit('setReady', false)
    
    const callback = (r) => {
      if (r.realtime) {
        switch (r.realtime.type) {
          case 'LOST':
            // Lost moves (white small circles) are disabled - do not show them
            break
          case 'BEST':
            // Only show best move if AI is actively thinking
            // This prevents showing stale best moves after board changes
            if (state.thinking) {
              commit('clearRealtime', 'best')
              commit('addRealtime', { type: 'best', pos: r.realtime.pos })
            }
            break
          default:
            break
        }
      } else if (r.msg) {
        commit('setOutput', { key: 'msg', value: r.msg })
        commit('addMessage', r.msg)
      } else if (r.multipv) {
        if (r.multipv == 'DONE') commit('setCurrentPV', 0)
        else commit('setCurrentPV', +r.multipv)
      } else if (r.depth) {
        commit('setPVOutput', { key: 'depth', value: r.depth })
      } else if (r.seldepth) {
        commit('setPVOutput', { key: 'seldepth', value: r.seldepth })
      } else if (r.nodes) {
        commit('setPVOutput', { key: 'nodes', value: r.nodes })
      } else if (r.totalnodes) {
        commit('setOutput', { key: 'nodes', value: r.totalnodes })
      } else if (r.totaltime) {
        commit('setOutput', { key: 'time', value: r.totaltime })
      } else if (r.speed) {
        commit('setOutput', { key: 'speed', value: r.speed })
      } else if (r.eval) {
        // CRITICAL: Check for -M0 eval which indicates engine error
        if (r.eval === '-M0') {
          // Only process once to avoid repeated alerts
          if (state.engineError) {
            return // Already handled, ignore further -M0 evals
          }
          
          console.error('[ERROR] ai/engine callback: Detected -M0 eval - Engine error!')
          console.error('[ERROR] ai/engine callback: This indicates forced defense on forbidden position bug')
          console.error('[ERROR] ai/engine callback: Position =', JSON.stringify(rootState.position.position))
          console.error('[ERROR] ai/engine callback: Shutting down AI engine immediately')
          
          // Set error flag
          commit('setEngineError', true)
          
          // Clear thinking timeout
          commit('clearThinkingTimeout')
          
          // Force stop AI and shut down
          commit('setThinkingState', false)
          commit('setReady', false) // Mark engine as not ready
          commit('setRestart', true)
          commit('clearRealtime', 'best')
          commit('clearRealtime', 'lost')
          
          // Clear posCallback and call with null to indicate failure
          const callback = state.posCallback
          commit('setPosCallback', null)
          if (callback) {
            callback(null)
            console.log('[ERROR] ai/engine callback: posCallback called with null due to -M0 error')
          }
          
          // Mark error as shown (no alert, silent shutdown)
          commit('setEngineErrorShown', true)
          
          return // Don't process this eval further
        }
        
        commit('setPVOutput', { key: 'eval', value: r.eval })
      } else if (r.winrate) {
        commit('setPVOutput', { key: 'winrate', value: r.winrate })
      } else if (r.bestline) {
        commit('setPVOutput', { key: 'bestline', value: r.bestline })
      } else if (r.pos) {
        console.log('[DEBUG] ai/engine callback: Received pos =', r.pos)
        
        // Clear thinking timeout since we got a response
        commit('clearThinkingTimeout')
        
        // Only process if we're actually thinking - prevents stale callbacks
        if (!state.thinking) {
          console.log('[DEBUG] ai/engine callback: WARNING - Not thinking, ignoring pos callback')
          return
        }
        
        const elapsedTime = Date.now() - state.thinkingStartTime
        console.log('[DEBUG] ai/engine callback: AI thinking completed in', elapsedTime, 'ms')
        
        // Handle mate situations (+M1, etc.) where pos might be empty but bestline[0] has the move
        let finalPos = r.pos
        if ((!finalPos || finalPos.length === 0) && state.outputs.pv[0] && state.outputs.pv[0].bestline && state.outputs.pv[0].bestline.length > 0) {
          finalPos = state.outputs.pv[0].bestline[0]
          console.log('[DEBUG] ai/engine callback: pos was empty, using bestline[0] =', finalPos)
        }
        
        commit('setOutput', { key: 'pos', value: finalPos })
        commit('addUsedTime')
        
        // CRITICAL: Add finalPos to realtime.best so the red dot is displayed
        // This is especially important for mate situations (+M1, etc.)
        if (finalPos && finalPos.length > 0) {
          commit('clearRealtime', 'best')
          commit('addRealtime', { type: 'best', pos: finalPos })
          console.log('[DEBUG] ai/engine callback: Added finalPos to realtime.best for display')
        }
        
        // Keep best move displayed after thinking completes (don't clear it)
        // This allows user to see the AI's recommendation
        commit('clearRealtime', 'lost')
        commit('sortPV')
        commit('setThinkingState', false)
        
        console.log('[DEBUG] ai/engine callback: Calling posCallback with pos =', finalPos)
        const callback = state.posCallback
        // Clear callback immediately to prevent duplicate calls
        commit('setPosCallback', null)
        
        if (callback) {
          callback(finalPos)
          console.log('[DEBUG] ai/engine callback: posCallback executed and cleared')
        } else {
          console.log('[DEBUG] ai/engine callback: WARNING - posCallback is null!')
        }
      } else if (r.swap) {
        commit('setOutput', { key: 'swap', value: r.swap })
      } else if (r.forbid) {
        commit('setOutput', { key: 'forbid', value: r.forbid })
      } else if (r.error) {
        commit('setOutput', { key: 'error', value: r.error })
        commit('addMessage', 'Error: ' + r.error)
      } else if (r.ok) {
        console.log('[DEBUG] ai/engine callback: Engine is ready!')
        commit('addMessage', 'Engine ready.')
        commit('setReady', true)
        console.log('[DEBUG] ai/engine callback: Checking forbid positions')
        dispatch('checkForbid')
      } else if (r.loading) {
        commit('setLoadingProgress', r.loading.progress)
      }
    }
    const engineURL = await engine.init(callback, loadFullEngine)
    commit('setFullEngine', loadFullEngine)
    commit('addMessage', 'Engine: ' + engineURL)
  },
  sendInfo({ rootState, rootGetters }) {
    engine.sendCommand('INFO RULE ' + rootState.settings.rule)
    engine.sendCommand('INFO THREAD_NUM ' + (rootState.settings.threads || 1))
    engine.sendCommand('INFO CAUTION_FACTOR ' + rootState.settings.candRange)
    engine.sendCommand('INFO STRENGTH ' + rootState.settings.strength)
    engine.sendCommand('INFO TIMEOUT_TURN ' + rootGetters['settings/turnTime'])
    engine.sendCommand('INFO TIMEOUT_MATCH ' + rootGetters['settings/matchTime'])
    engine.sendCommand('INFO MAX_DEPTH ' + rootGetters['settings/depth'])
    engine.sendCommand('INFO MAX_NODE ' + rootGetters['settings/nodes'])
    engine.sendCommand('INFO SHOW_DETAIL ' + (rootState.settings.showDetail ? 3 : 2))
    engine.sendCommand('INFO PONDERING ' + (rootState.settings.pondering ? 1 : 0))
    engine.sendCommand('INFO SWAPABLE ' + (rootState.position.swaped ? 0 : 1))
  },
  sendBoard({ rootState }, immediateThink) {
    let position = rootState.position.position
    console.log('[DEBUG] ai/sendBoard: called')
    console.log('[DEBUG] ai/sendBoard: immediateThink =', immediateThink)
    console.log('[DEBUG] ai/sendBoard: position.length =', position.length)
    console.log('[DEBUG] ai/sendBoard: position =', JSON.stringify(position))

    let command = immediateThink ? 'BOARD' : 'YXBOARD'
    let side = position.length % 2 == 0 ? 1 : 2
    for (let pos of position) {
      command += ' ' + pos[0] + ',' + pos[1] + ',' + side
      side = 3 - side
    }
    command += ' DONE'
    console.log('[DEBUG] ai/sendBoard: Sending command:', command)
    engine.sendCommand(command)
  },
  think({ commit, dispatch, state, rootState, rootGetters }, args) {
    console.log('[DEBUG] ai/think: ========== THINK CALLED ==========')
    console.log('[DEBUG] ai/think: state.ready =', state.ready)
    console.log('[DEBUG] ai/think: state.thinking =', state.thinking)
    console.log('[DEBUG] ai/think: position.length =', rootState.position.position.length)
    console.log('[DEBUG] ai/think: Current position =', JSON.stringify(rootState.position.position))
    console.log('[DEBUG] ai/think: Last think position =', JSON.stringify(state.lastThinkPosition))
    console.log('[DEBUG] ai/think: args =', args)
    
    if (!state.ready) {
      console.log('[DEBUG] ai/think: Engine is not ready, rejecting promise')
      commit('addMessage', 'Engine is not ready!')
      return Promise.reject(new Error('Engine is not ready!'))
    }
    
    // Critical: Check if position has changed since last think
    const positionChanged = JSON.stringify(rootState.position.position) !== JSON.stringify(state.lastThinkPosition)
    console.log('[DEBUG] ai/think: Position changed since last think?', positionChanged)
    
    // If position changed or restart flag is set, force engine restart
    if (positionChanged || state.restart || state.startSize != rootState.position.size) {
      console.log('[DEBUG] ai/think: FORCING ENGINE RESTART due to position change or restart flag')
      commit('setRestart', true)
    }
    
    console.log('[DEBUG] ai/think: Setting thinking state to true')
    commit('setThinkingState', true)
    commit('setOutput', { key: 'swap', value: false })
    commit('clearMessage')

    console.log('[DEBUG] ai/think: Reloading config, updating hash size, sending info')
    dispatch('reloadConfig')
    dispatch('updateHashSize')
    dispatch('sendInfo')

    if (state.restart || state.startSize != rootState.position.size) {
      console.log('[DEBUG] ai/think: Restarting engine, startSize =', state.startSize, 'boardSize =', rootState.position.size)
      engine.sendCommand('START ' + rootState.position.size)
      commit('setRestart', false)
      commit('setStartSize', rootState.position.size)
      commit('clearUsedTime')
    }

    let timeLeft = Math.max(rootGetters['settings/matchTime'] - state.timeUsed, 1)
    console.log('[DEBUG] ai/think: Sending TIME_LEFT =', timeLeft)
    engine.sendCommand('INFO TIME_LEFT ' + timeLeft)

    console.log('[DEBUG] ai/think: *** CRITICAL: Sending current board state to engine ***')
    console.log('[DEBUG] ai/think: Position being sent =', JSON.stringify(rootState.position.position))
    dispatch('sendBoard', false)
    
    // CRITICAL: Check for forbidden moves BEFORE starting AI thinking
    // This ensures forbid information is available when filtering AI recommendations
    if (rootGetters['settings/gameRule'] == RENJU) {
      console.log('[DEBUG] ai/think: Checking forbidden moves before AI thinking')
      dispatch('checkForbid')
    }
    commit('setThinkStartTime')
    commit('setLastThinkPosition', rootState.position.position)
    commit('clearOutput')

    if (args && args.balanceMode) {
      console.log('[DEBUG] ai/think: Balance mode =', args.balanceMode)
      engine.sendCommand(
        (args.balanceMode == 2 ? 'YXBALANCETWO ' : 'YXBALANCEONE ') + (args.balanceBias || 0)
      )
    } else {
      console.log('[DEBUG] ai/think: Starting normal thinking with nbest =', rootState.settings.nbest)
      engine.sendCommand('YXNBEST ' + rootState.settings.nbest)
    }

    // Record thinking start time
    commit('setThinkingStartTime', Date.now())
    
    // Set timeout for AI thinking (30 seconds)
    const timeout = setTimeout(() => {
      console.error('[ERROR] ai/think: AI TIMEOUT - No response after 30 seconds!')
      console.error('[ERROR] ai/think: Position =', JSON.stringify(rootState.position.position))
      console.error('[ERROR] ai/think: This may indicate an engine bug (e.g., forced defense on forbidden position)')
      console.error('[ERROR] ai/think: Shutting down AI engine')
      
      // Set error flag
      commit('setEngineError', true)
      
      // Force engine shutdown
      commit('clearThinkingTimeout')
      commit('setThinkingState', false)
      commit('setReady', false) // Mark engine as not ready
      commit('setRestart', true)
      commit('clearRealtime', 'best')
      commit('clearRealtime', 'lost')
      
      // Call posCallback with null to indicate failure
      const callback = state.posCallback
      commit('setPosCallback', null)
      if (callback) {
        callback(null)
      }
      
      // Mark error as shown (no alert, silent shutdown)
      commit('setEngineErrorShown', true)
    }, 30000) // 30 seconds timeout
    
    commit('setThinkingTimeout', timeout)
    console.log('[DEBUG] ai/think: Set 30-second timeout for AI thinking')
    
    console.log('[DEBUG] ai/think: Returning promise, waiting for engine response')
    return new Promise((resolve) => {
      commit('setPosCallback', resolve)
    })
  },
  stop({ commit, state }) {
    console.log('[DEBUG] ai/stop: ========== STOP CALLED ==========')
    console.log('[DEBUG] ai/stop: state.thinking =', state.thinking)
    
    // Clear thinking timeout
    commit('clearThinkingTimeout')
    console.log('[DEBUG] ai/stop: Cleared thinking timeout')
    
    // CRITICAL: Clear posCallback immediately to prevent stale callbacks
    commit('setPosCallback', null)
    console.log('[DEBUG] ai/stop: Cleared posCallback to prevent stale callbacks')
    
    if (!state.thinking) {
      console.log('[DEBUG] ai/stop: Not thinking, but forcing restart flag anyway')
      commit('setRestart', true)
      return false
    }

    // Always clear best move when stopping - board state is changing
    commit('clearRealtime', 'best')
    commit('clearRealtime', 'lost')

    console.log('[DEBUG] ai/stop: Calling engine.stopThinking()')
    if (engine.stopThinking()) {
      console.log('[DEBUG] ai/stop: Engine was force stopped (terminated)')
      commit('setReady', false)
      commit('addUsedTime')
      commit('sortPV')
      commit('setThinkingState', false)
      // Don't automatically make a move when stopping - just stop
      commit('setRestart', true)
      // Reset to initial state
      commit('setCurrentConfig', null)
      commit('setHashSize', null)
      console.log('[DEBUG] ai/stop: Restart flag set to true')
      return true
    }

    console.log('[DEBUG] ai/stop: Engine stop command sent (not terminated)')
    // Even if engine wasn't terminated, clear thinking state and set restart flag
    commit('addUsedTime')
    commit('sortPV')
    commit('setThinkingState', false)
    commit('setRestart', true)
    console.log('[DEBUG] ai/stop: Thinking state cleared, restart flag set')
    return false
  },
  restart({ commit }) {
    commit('setRestart')
    commit('clearUsedTime')
    commit('clearOutput')
    // Clear best move when restarting
    commit('clearRealtime', 'best')
    commit('clearRealtime', 'lost')
  },
  async forceRestartEngine({ commit, dispatch }) {
    console.log('[DEBUG] ai/forceRestartEngine: ========== FORCE RESTART ENGINE ==========')
    
    // Clear all states
    commit('clearThinkingTimeout')
    commit('setPosCallback', null)
    commit('setThinkingState', false)
    commit('setRestart', true)
    commit('clearRealtime', 'best')
    commit('clearRealtime', 'lost')
    commit('setReady', false)
    
    // Clear error flags
    commit('setEngineError', false)
    commit('setEngineErrorShown', false)
    
    // Reset engine state
    commit('setCurrentConfig', null)
    commit('setHashSize', null)
    commit('setStartSize', 15)
    commit('clearUsedTime')
    
    console.log('[DEBUG] ai/forceRestartEngine: Re-initializing engine...')
    
    // Re-initialize engine
    try {
      await dispatch('initEngine', true)
      console.log('[DEBUG] ai/forceRestartEngine: Engine restarted successfully')
      commit('addMessage', 'AI engine has been restarted successfully.')
      return true
    } catch (error) {
      console.error('[ERROR] ai/forceRestartEngine: Failed to restart engine:', error)
      commit('addMessage', 'Failed to restart AI engine. Please reload the page.')
      return false
    }
  },
  reloadConfig({ commit, state, rootState }) {
    if (rootState.settings.configIndex == state.currentConfig) return
    commit('setCurrentConfig', rootState.settings.configIndex)

    engine.sendCommand('RELOADCONFIG ' + (CONFIGS[state.currentConfig] || ''))
  },
  updateHashSize({ commit, state, rootState }) {
    if (rootState.settings.hashSize == state.hashSize) return
    commit('setHashSize', rootState.settings.hashSize)

    engine.sendCommand('INFO HASH_SIZE ' + state.hashSize * 1024)
    commit('addMessage', `Hash size reset to ${state.hashSize} MB.`)
  },
  checkForbid({ commit, state, dispatch, rootState, rootGetters }) {
    console.log('[DEBUG] ai/checkForbid: called')
    commit('setOutput', { key: 'forbid', value: [] })
    if (!state.ready) {
      console.log('[DEBUG] ai/checkForbid: Engine not ready, returning')
      return
    }

    if (rootGetters['settings/gameRule'] == RENJU) {
      console.log('[DEBUG] ai/checkForbid: RENJU rule active, checking forbid positions')
      dispatch('sendInfo')
      if (state.restart || state.startSize != rootState.position.size) {
        console.log('[DEBUG] ai/checkForbid: Restarting engine for forbid check')
        engine.sendCommand('START ' + rootState.position.size)
        commit('setRestart', false)
        commit('setStartSize', rootState.position.size)
      }
      console.log('[DEBUG] ai/checkForbid: Sending current board state')
      console.log('[DEBUG] ai/checkForbid: Position =', JSON.stringify(rootState.position.position))
      dispatch('sendBoard', false)
      engine.sendCommand('YXSHOWFORBID')
      console.log('[DEBUG] ai/checkForbid: YXSHOWFORBID command sent')
    }
  },
}

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
}
