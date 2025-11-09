<template>
  <div class="game">
    <div class="board-box">
      <Board ref="board" :is-ai-turn="isAITurn" :preview-pv="previewPv" @clicked="clicked"></Board>

      <div class="button-box" :class="{ 'mobile': isMobile }">
        <scroller lock-y :scrollbar-x="!isMobile && $store.state.screenWidth < buttonBarWidth" :bounce="false">
          <div class="button-box-inner" :style="{ width: isMobile ? 'auto' : `${buttonBarWidth}px` }">
            <flexbox :gutter="isMobile ? 8 : 0" justify="center">
              <flexbox-item>
                <x-button :disabled="position.length == 0 || navigationButtonsDisabled" :class="{ 'mobile-button': isMobile }" @click.native="handleBackToBegin">
                  <i class="fa fa-angle-double-left fa-lg" aria-hidden="true"></i>
                </x-button>
              </flexbox-item>
              <flexbox-item>
                <x-button :disabled="position.length == 0 || navigationButtonsDisabled" :class="{ 'mobile-button': isMobile }" @click.native="handleBackward">
                  <i class="fa fa-angle-left fa-lg" aria-hidden="true"></i>
                </x-button>
              </flexbox-item>
              <flexbox-item>
                <x-button :disabled="position.length == lastPosition.length || navigationButtonsDisabled" :class="{ 'mobile-button': isMobile }" @click.native="handleForward">
                  <i class="fa fa-angle-right fa-lg" aria-hidden="true"></i>
                </x-button>
              </flexbox-item>
              <flexbox-item>
                <x-button :disabled="position.length == lastPosition.length || navigationButtonsDisabled" :class="{ 'mobile-button': isMobile }" @click.native="handleForwardToEnd">
                  <i class="fa fa-angle-double-right fa-lg" aria-hidden="true"></i>
                </x-button>
              </flexbox-item>
            </flexbox>
          </div>
        </scroller>
      </div>
    </div>

    <div class="info-box" :class="{ 'mobile': isMobile }" :style="showAnalysis ? {} : { display: 'none' }">
      <div class="info-box-inner" :class="{ 'mobile': isMobile }">

        <!-- 单点分析的信息输出 -->
        <div v-if="nbest == 1" class="table-container" :class="{ 'mobile': isMobile }">
          <x-table :cell-bordered="true" class="info-table" :class="{ 'mobile': isMobile }">
            <thead>
              <tr style="background-color: #f7f7f7">
                <th style="width: 80px;">{{ $t('game.info.depth') }}</th>
                <th style="width: 80px;">{{ $t('game.info.eval') }}</th>
                <th style="width: 80px;">{{ $t('game.info.speed') }}</th>
                <th style="width: 80px;">{{ $t('game.info.nodes') }}</th>
                <th style="width: 80px;">{{ $t('game.info.time') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="width: 80px;">{{ outputs.pv[0].depth + '-' + outputs.pv[0].seldepth }}</td>
                <td style="font-weight: bold; width: 80px;">{{ outputs.pv[0].eval }}</td>
                <td style="width: 80px;">{{ getSpeedText(outputs.speed) }}</td>
                <td style="width: 80px;">{{ getNodesText(outputs.nodes) }}</td>
                <td style="width: 80px;">{{ getTimeText(outputs.time) }}</td>
              </tr>
              <tr>
                <td colspan="5" class="bestline-cell">
                  <div class="bestline-content">
                    <Bestline :bestline="outputs.pv[0].bestline" :boardSize="boardSize"
                      v-on:pvPreview="(pv) => (previewPv = pv)" v-on:pvSet="setPvAsPosition"></Bestline>
                  </div>
                </td>
              </tr>
            </tbody>
          </x-table>
        </div>

        <!-- 多点分析的信息输出 -->
        <div v-else class="table-container" :class="{ 'mobile': isMobile }">
          <x-table :cell-bordered="true" class="info-table" :class="{ 'mobile': isMobile }">
            <thead>
              <tr style="background-color: #f7f7f7">
                <th style="width: 100px;">{{ $t('game.info.speed') }}</th>
                <th style="width: 100px;">{{ $t('game.info.nodes') }}</th>
                <th style="width: 100px;">{{ $t('game.info.time') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="width: 100px;">{{ getSpeedText(outputs.speed) }}</td>
                <td style="width: 100px;">{{ getNodesText(outputs.nodes) }}</td>
                <td style="width: 100px;">{{ getTimeText(outputs.time) }}</td>
              </tr>
            </tbody>
          </x-table>
          <x-table :cell-bordered="true" class="info-table" :class="{ 'mobile': isMobile }">
            <thead>
              <tr style="background-color: #f7f7f7">
                <th style="width: 50px;">{{ $t('game.info.nbestIndex') }}</th>
                <th style="width: 80px;">{{ $t('game.info.depth') }}</th>
                <th style="width: 80px;">{{ $t('game.info.eval') }}</th>
                <th>{{ $t('game.info.bestline') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in Math.min(nbest, outputs.pv.length)" :key="i">
                <td style="width: 50px;">{{ i }}</td>
                <td style="width: 80px;">
                  {{ outputs.pv[i - 1].depth + '-' + outputs.pv[i - 1].seldepth }}
                </td>
                <td style="font-weight: bold; width: 80px;">{{ outputs.pv[i - 1].eval }}</td>
                <td class="bestline-cell" style="overflow-y: auto; overflow-wrap: break-word; word-break: break-all;">
                  <div class="bestline-content">
                    <Bestline :bestline="outputs.pv[i - 1].bestline" :boardSize="boardSize"
                      v-on:pvPreview="(pv) => (previewPv = pv)" v-on:pvSet="setPvAsPosition"></Bestline>
                  </div>
                </td>
              </tr>
            </tbody>
          </x-table>
        </div>
      </div>

      <group class="position-group" :class="{ 'mobile': isMobile }">
        <group-title slot="title">
          {{ $t('game.currentPos') }}
          <span v-if="clipboardAvailable" style="float:right;">
            <button class="icon-button" @click="copyPosStrToClipboard">
              <i class="fa fa-files-o" aria-hidden="true"></i>
            </button>
          </span>
        </group-title>
        <x-textarea ref="curposArea" :value="posStr" @on-change="(v) => { setPosStr(v) }" 
          class="position-textarea" :class="{ 'mobile': isMobile }"
          :show-counter="false" :rows="3"></x-textarea>
      </group>

    </div>
  </div>
</template>

<script>
import {
  TransferDom,
  Flexbox,
  FlexboxItem,
  XButton,
  Scroller,
  LoadMore,
  XTable,
  XTextarea,
  Group,
  GroupTitle,
} from 'vux'
import Board from '@/components/Board.vue'
import Bestline from '@/components/Bestline.vue'
import { mapState, mapGetters, mapMutations, mapActions } from 'vuex'
import { Promise } from 'q'
import { RENJU } from '@/store/modules/settings'

export default {
  name: 'game',
  directives: {
    TransferDom,
  },
  components: {
    Board,
    Bestline,
    Flexbox,
    FlexboxItem,
    XButton,
    Scroller,
    LoadMore,
    XTable,
    XTextarea,
    Group,
    GroupTitle,
  },
  data: function () {
    return {
      aiTimeUsed: 0,
      console: console,
      evalData: [
        { index: 0, eval: 0, piece: this.$t('game.black') },
        { index: 0, eval: 0, piece: this.$t('game.white') },
      ],
      thinkingCanceled: false,
      previewPv: null,
      navigationButtonsDisabled: false, // Prevent button spamming
      moveDisabled: false, // Prevent move spamming
      clipboardAvailable: navigator.clipboard && window.isSecureContext
    }
  },
  computed: {
    ...mapState(['screenWidth', 'screenHeight']),
    ...mapState('settings', [
      'boardSize',
      'indexOrigin',
      'rule',
      'nbest',
      'aiThinkBlack',
      'aiThinkWhite',
      'showAnalysis',
    ]),
    ...mapState('ai', ['outputs', 'thinking', 'lastThinkTime', 'ready', 'loadingProgress', 'engineError']),
    ...mapState('position', ['position', 'lastPosition', 'winline', 'swaped']),
    ...mapGetters('settings', ['turnTime', 'matchTime', 'gameRule']),
    ...mapGetters('ai', ['bestlineStr', 'bestline']),
    ...mapGetters('position', ['isEmpty', 'playerToMove', 'moveLeftCount', 'posStr']),
    buttonBarWidth() {
      // 스마트폰에서는 버튼 너비를 훨씬 작게 (약 1/4)
      if (this.screenWidth < 768) {
        return 150 // 스마트폰: 5개 버튼이 작게 배치
      }
      const Width = 620
      if (this.screenWidth >= 1024)
        return Math.min(Width, Width + Math.max(0, this.screenWidth - 1024))
      else
        return Width
    },
    isMobile() {
      return this.screenWidth < 768
    },
    bestline() {
      return this.bestlineStr(0)
    },
    isAITurn() {
      return (
        (this.playerToMove == 'BLACK' && this.aiThinkBlack) ||
        (this.playerToMove == 'WHITE' && this.aiThinkWhite)
      )
    },
    gameEnded() {
      return this.winline.length > 0 || this.moveLeftCount == 0
    },
  },
  methods: {
    ...mapMutations('position', {
      newBoard: 'new',
      setSwaped: 'setSwaped',
    }),
    ...mapMutations('settings', ['setValue']),
    ...mapMutations('ai', ['clearUsedTime', 'clearRealtime']),
    ...mapActions('position', [
      'setPosStr',
      'makeMove',
      'backToBegin',
      'backward',
      'forward',
      'forwardToEnd',
      'rotate',
      'flip',
      'moveTowards',
    ]),
    ...mapActions('ai', ['think', 'stop', 'restart', 'forceRestartEngine']),

    checkThinking() {
      return new Promise((resolve) => {
        if (this.thinking) {
          this.$vux.confirm.show_i18n({
            title: this.$t('game.interruptThinking.title'),
            content: this.$t('game.interruptThinking.msg'),
            onCancel: () => { },
            onConfirm: () => {
              this.thinkingCanceled = true
              this.stop()
              resolve()
            },
          })
        } else resolve()
      })
    },

    stopAIAndSync() {
      console.log('[DEBUG] stopAIAndSync() called, thinking:', this.thinking)
      // Always clear best move when board state is changing
      this.clearRealtime('best')
      this.clearRealtime('lost')
      console.log('[DEBUG] stopAIAndSync: Cleared best move')
      
      return new Promise((resolve) => {
        if (this.thinking) {
          console.log('[DEBUG] AI is thinking, stopping...')
          this.thinkingCanceled = true
          this.stop()
          // Wait a bit to ensure AI fully stops and state is cleared
          // This is critical for board state synchronization when AI is active
          setTimeout(() => {
            this.thinkingCanceled = false
            console.log('[DEBUG] AI stopped, resolving promise')
            // Force restart flag to ensure fresh board state is sent
            this.restart()
            resolve()
          }, 100)  // Reduced from 200ms to 100ms for better responsiveness
        } else {
          console.log('[DEBUG] AI not thinking, resolving immediately')
          // No delay needed when AI is not thinking - instant response!
          this.restart()
          resolve()
        }
      })
    },

    async autoStartAI() {
      // Auto-start AI if it's AI's turn and game hasn't ended
      // This is called after board state changes to ensure AI analyzes the new position
      console.log('[DEBUG] autoStartAI() called')
      console.log('[DEBUG] - isAITurn:', this.isAITurn)
      console.log('[DEBUG] - gameEnded:', this.gameEnded)
      console.log('[DEBUG] - ready:', this.ready)
      console.log('[DEBUG] - engineError:', this.engineError)
      console.log('[DEBUG] - playerToMove:', this.playerToMove)
      console.log('[DEBUG] - aiThinkBlack:', this.aiThinkBlack)
      console.log('[DEBUG] - aiThinkWhite:', this.aiThinkWhite)
      console.log('[DEBUG] - position.length:', this.position.length)
      console.log('[DEBUG] - thinking:', this.thinking)
      
      // If engine is in error state, restart it automatically when board state changes
      if (this.engineError) {
        console.log('[DEBUG] autoStartAI: Engine is in error state, attempting restart...')
        const success = await this.forceRestartEngine()
        if (!success) {
          console.error('[ERROR] autoStartAI: Failed to restart engine')
          return
        }
        console.log('[DEBUG] autoStartAI: Engine restarted successfully')
      }
      
      // Wait a bit to ensure board state is fully updated
      this.$nextTick(() => {
        if (this.isAITurn && !this.gameEnded && this.ready && !this.thinking) {
          console.log('[DEBUG] All conditions met, calling startThink() after nextTick')
          this.startThink()
        } else {
          console.log('[DEBUG] Conditions not met, NOT starting AI:')
          if (!this.isAITurn) console.log('[DEBUG]   - isAITurn is false')
          if (this.gameEnded) console.log('[DEBUG]   - gameEnded is true')
          if (!this.ready) console.log('[DEBUG]   - ready is false')
          if (this.thinking) console.log('[DEBUG]   - thinking is true (AI still running)')
        }
      })
    },


    newGame() {
      console.log('[DEBUG] ========== NEW GAME ==========')
      // Clear best move immediately when starting new game
      this.clearRealtime('best')
      this.clearRealtime('lost')
      console.log('[DEBUG] newGame: Cleared best move')
      
      // Reset move disabled flag
      this.moveDisabled = false
      
      this.stopAIAndSync().then(() => {
        console.log('[DEBUG] newGame: stopAIAndSync completed')
        // Create new empty board
        this.newBoard(this.boardSize)
        console.log('[DEBUG] newGame: New board created')
        // Clear eval data for new game
        this.evalData = [
          { index: 0, eval: 0, piece: this.$t('game.black') },
          { index: 0, eval: 0, piece: this.$t('game.white') },
        ]
        console.log('[DEBUG] newGame: Eval data cleared')
        // Force restart to ensure fresh state
        this.restart()
        console.log('[DEBUG] newGame: Restart flag set')
        // Wait for board to be fully initialized before starting AI
        this.$nextTick(() => {
          console.log('[DEBUG] newGame: Board initialized, calling autoStartAI()')
          this.autoStartAI()
        })
      })
    },

    // Navigation button handlers with throttling to prevent rapid clicking
    handleBackward() {
      if (this.navigationButtonsDisabled) return
      
      console.log('[DEBUG] backward button clicked')
      this.navigationButtonsDisabled = true
      
      this.stopAIAndSync().then(() => {
        console.log('[DEBUG] backward: stopAIAndSync completed')
        this.backward()
        this.clearUsedTime()
        console.log('[DEBUG] backward: calling autoStartAI()')
        this.autoStartAI()
        
        // Re-enable button after 300ms
        setTimeout(() => {
          this.navigationButtonsDisabled = false
        }, 300)
      })
    },

    handleForward() {
      if (this.navigationButtonsDisabled) return
      
      console.log('[DEBUG] forward button clicked')
      this.navigationButtonsDisabled = true
      
      this.stopAIAndSync().then(() => {
        console.log('[DEBUG] forward: stopAIAndSync completed')
        this.forward()
        console.log('[DEBUG] forward: calling autoStartAI()')
        this.autoStartAI()
        
        // Re-enable button after 300ms
        setTimeout(() => {
          this.navigationButtonsDisabled = false
        }, 300)
      })
    },

    handleBackToBegin() {
      if (this.navigationButtonsDisabled) return
      
      console.log('[DEBUG] backToBegin button clicked')
      this.navigationButtonsDisabled = true
      this.moveDisabled = true // 착수도 막기
      
      this.stopAIAndSync().then(() => {
        console.log('[DEBUG] backToBegin: stopAIAndSync completed')
        this.backToBegin()
        console.log('[DEBUG] backToBegin: calling autoStartAI()')
        this.autoStartAI()
        
        // Re-enable buttons and moves after 5 seconds
        setTimeout(() => {
          this.navigationButtonsDisabled = false
          this.moveDisabled = false
          console.log('[DEBUG] backToBegin: Navigation and moves re-enabled after 5 seconds')
        }, 5000)
      })
    },

    handleForwardToEnd() {
      if (this.navigationButtonsDisabled) return
      
      console.log('[DEBUG] forwardToEnd button clicked')
      this.navigationButtonsDisabled = true
      this.moveDisabled = true // 착수도 막기
      
      this.stopAIAndSync().then(() => {
        console.log('[DEBUG] forwardToEnd: stopAIAndSync completed')
        this.forwardToEnd()
        console.log('[DEBUG] forwardToEnd: calling autoStartAI()')
        this.autoStartAI()
        
        // Re-enable buttons and moves after 5 seconds
        setTimeout(() => {
          this.navigationButtonsDisabled = false
          this.moveDisabled = false
          console.log('[DEBUG] forwardToEnd: Navigation and moves re-enabled after 5 seconds')
        }, 5000)
      })
    },

    clicked(e) {
      let pos = [e.x, e.y]
      console.log('[DEBUG] ========== BOARD CLICKED ==========')
      console.log('[DEBUG] clicked: pos =', pos, 'button =', e.button)

      if (e.button == 0) {
        // Prevent rapid consecutive moves
        if (this.moveDisabled) {
          console.log('[DEBUG] clicked: Move disabled, ignoring click')
          return
        }
        
        // Always allow user to make moves - check if position is valid
        if (this.isEmpty(pos) && this.winline.length == 0) {
          // User wants to make a move
          if (this.rule == 5 && !this.swaped && this.position.length == 1) {
            // SWAP1 rule
            // Disable moves during swap dialog
            this.moveDisabled = true
            
            return this.$vux.confirm.show_i18n({
              title: this.$t('game.swap.questionTitle'),
              content: this.$t('game.swap.questionMsg'),
              onCancel: () => {
                this.setSwaped()
                this.stopAIAndSync().then(() => {
                  this.autoStartAI()
                  setTimeout(() => {
                    this.moveDisabled = false
                  }, 400)
                })
              },
              onConfirm: () => {
                this.swapBlackAndWhite()
                this.stopAIAndSync().then(() => {
                  if (this.isAITurn) this.autoStartAI()
                  setTimeout(() => {
                    this.moveDisabled = false
                  }, 400)
                })
              },
            })
          } else if (this.gameRule == RENJU) {
            let isForbidPos = false
            for (let forbidPos of this.outputs.forbid) {
              if (pos[0] == forbidPos[0] && pos[1] == forbidPos[1]) {
                isForbidPos = true
                break
              }
            }
            if (isForbidPos) {
              return this.$vux.alert.show_i18n({
                title: this.$t('game.forbid.title'),
                content: this.$t('game.forbid.msg'),
              })
            }
          }

          console.log('[DEBUG] clicked: Valid user move, stopping AI and making move')
          
          // Disable moves to prevent rapid clicking
          this.moveDisabled = true
          console.log('[DEBUG] clicked: Move disabled')
          
          this.stopAIAndSync().then(() => {
            console.log('[DEBUG] clicked: stopAIAndSync completed, making move at', pos)
            console.log('[DEBUG] clicked: Position before move:', JSON.stringify(this.position))
            this.makeMove(pos)
            console.log('[DEBUG] clicked: Position after move:', JSON.stringify(this.position))
            console.log('[DEBUG] clicked: move made, calling autoStartAI()')
            this.autoStartAI()
            
            // Re-enable moves after delay
            setTimeout(() => {
              this.moveDisabled = false
              console.log('[DEBUG] clicked: Move re-enabled')
            }, 400) // 400ms delay to prevent rapid moves
          })
        } else {
          console.log('[DEBUG] clicked: Invalid move - position not empty or game ended')
        }
      } else if (e.button == 2) {
        console.log('[DEBUG] clicked: Right click (backward)')
        this.handleBackward()
      }
    },

    startThink() {
      console.log('[DEBUG] startThink() called')
      console.log('[DEBUG] - gameEnded:', this.gameEnded)
      console.log('[DEBUG] - ready:', this.ready)
      console.log('[DEBUG] - thinking:', this.thinking)
      
      if (this.gameEnded) {
        console.log('[DEBUG] Game ended, returning early')
        return
      }

      console.log('[DEBUG] Calling think() action...')
      this.think().then((pos) => {
        console.log('[DEBUG] think() promise resolved, pos:', pos)
        console.log('[DEBUG] - thinkingCanceled:', this.thinkingCanceled)
        if (this.thinkingCanceled) {
          this.thinkingCanceled = false
          return
        }

        // AI should only think, NOT make moves automatically
        // Remove automatic move making - AI just analyzes
        console.log('[DEBUG] startThink: AI finished thinking, pos =', pos)
        console.log('[DEBUG] startThink: NOT making move automatically - AI only thinks')
        
        if (this.outputs.swap) {
          this.swapBlackAndWhite()
          this.$vux.alert.show_i18n({
            title: this.$t('game.swap.title'),
            content: this.$t('game.swap.msg'),
            onHide: () => {
              if (this.isAITurn) this.autoStartAI()
            },
          })
        } else {
          // AI finished thinking - just update eval data, don't make move
          let e = +this.outputs.pv[0].eval
          if (!isNaN(e)) {
            this.evalData.push({
              index: this.position.length,
              eval: e,
              piece: this.playerToMove == 'BLACK' ? this.$t('game.white') : this.$t('game.black'),
            })
          }
          // Don't auto-start AI again - wait for user or board state change
        }
      })
    },


    swapBlackAndWhite() {
      this.setSwaped()
      let thinkBlack = this.aiThinkWhite
      let thinkWhite = this.aiThinkBlack
      this.setValue({ key: 'aiThinkBlack', value: thinkBlack })
      this.setValue({ key: 'aiThinkWhite', value: thinkWhite })
    },

    setPvAsPosition(pv) {
      this.stopAIAndSync().then(() => {
        let fullPosition = pv.position.concat(pv.pv)
        this.newBoard(this.boardSize)
        for (let pos of fullPosition) {
          if (!this.makeMove(pos)) break
        }
        this.autoStartAI()
      })
    },

    getSpeedText(speed) {
      if (speed < 10000) {
        return speed.toString();
      } else if (speed < 100000000) {
        return Math.floor(speed / 1000) + "K";
      } else {
        return Math.floor(speed / 1000000) + "M";
      }
    },

    getNodesText(nodes) {
      if (nodes < 10000) {
        return nodes.toString();
      } else if (nodes < 10000000) {
        return Math.floor(nodes / 1000) + "K";
      } else if (nodes < 100000000000) {
        return Math.floor(nodes / 1000000) + "M";
      } else if (nodes < 100000000000000) {
        return Math.floor(nodes / 1000000000) + "G";
      } else {
        return Math.floor(nodes / 1000000000000) + "T";
      }
    },

    getTimeText(time) {
      if (time < 1000000) {
        return Math.floor(time / 1000) + "." + (Math.floor(time / 100) % 10) + "s";
      } else if (time < 360000000) {
        return Math.floor(time / 60000) + "min";
      } else {
        return Math.floor(time / 3600000) + "h";
      }
    },

    async copyPosStrToClipboard() {
      await navigator.clipboard.writeText(this.posStr);
      this.$vux.toast.text(this.$t('game.copiedToClipboard'))
    },

  },
  watch: {
    posStr: function (newPos) {
      let oldIndex = this.evalData[this.evalData.length - 1].index
      let newIndex = Math.max(this.position.length, 1)
      if (newIndex < oldIndex) {
        for (let i = this.evalData.length - 1; i > 0; i--) {
          if (this.evalData[i].index > newIndex) this.evalData.pop()
        }
      }
      if (newPos.length > 0) this.$router.push({ name: 'game', params: { pos: newPos } })
      else this.$router.push({ name: 'game' })
    },
    boardSize: function (newSize) {
      this.stopAIAndSync().then(() => {
        this.newBoard(newSize)
        this.restart()
        this.autoStartAI()
      })
    },
    // Position watch removed - board state changes are handled directly in actions
    // to avoid duplicate AI restarts
    loadingProgress: function (progress) {
      if (progress == 1) this.showLoading = false
    },
    ready: function (newReady) {
      // When engine becomes ready, auto-start AI if it's AI's turn
      console.log('[DEBUG] ready watcher: newReady =', newReady)
      if (newReady) {
        console.log('[DEBUG] Engine is ready, scheduling autoStartAI()')
        this.$nextTick(() => {
          console.log('[DEBUG] ready watcher: calling autoStartAI() in nextTick')
          this.autoStartAI()
        })
      }
    },
  },
  mounted() {
    this.newBoard(this.boardSize)
    if (this.$route.params.pos) this.setPosStr(this.$route.params.pos)

    // Auto-start AI when component is mounted and ready
    console.log('[DEBUG] Component mounted')
    console.log('[DEBUG] - ready:', this.ready)
    console.log('[DEBUG] - isAITurn:', this.isAITurn)
    this.$nextTick(() => {
      console.log('[DEBUG] mounted: nextTick callback')
      if (this.ready) {
        console.log('[DEBUG] mounted: ready is true, calling autoStartAI()')
        this.autoStartAI()
      } else {
        console.log('[DEBUG] mounted: ready is false, NOT calling autoStartAI()')
      }
    })

    window.addEventListener('keydown', (event) => {
      const target = event.target

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        return
      if (event.repeat)
        return

      switch (event.key) {
        case 'ArrowLeft':
          this.handleBackward()
          break
        case 'ArrowRight':
          this.handleForward()
          break
        case 'Home':
          this.handleBackToBegin()
          break
        case 'End':
          this.handleForwardToEnd()
          break
      }
    })
    setInterval(() => {
      this.aiTimeUsed = this.thinking ? Date.now() - this.lastThinkTime : 0
    }, 100)
  },
}
</script>

<style lang="less" scoped>
.selectable {
  -webkit-user-select: text;
  -khtml-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

.game {
  overflow-x: hidden;
}

.button-box {
  margin: auto;
  margin-top: ~'min(1vw, 10px)';
}

.seperator {
  margin-top: 20px;
  margin-bottom: 0px;
}

.screenshot-box {
  width: 95%;
  text-align: center;
  background-color: #fff;
  height: 95%;
  margin: 0 auto;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
}

.screenshot-img {
  -webkit-touch-callout: default;
  flex: 1 1 auto;
  align-self: center;
  max-width: 100%;
  max-height: calc(100% - 42px);
}

@media (min-aspect-ratio: ~'4/3') and (min-width: 1024px) {
  .seperator {
    display: none !important;
  }

  .game {
    display: flex;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: stretch;
  }

  .board-box {
    margin: 20px 10px;
  }

  @infobox-padding: ~'min(20px, max(30vw - 350px, 0px))';

  .info-box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: stretch;
    margin-top: 20px;
    margin-left: @infobox-padding;
    margin-right: calc(10px + @infobox-padding);
    padding-top: 10px;
    max-width: 600px;
  }
}

.loading-circle {
  width: 100px;
  height: 100px;
  margin: 20px auto;
}

.icon-button {
  background: none;
  border: none;
  padding: 0.1rem 0.25rem;
  border-radius: 0.1rem;
  transition: background-color 0.2s ease;
}

.icon-button:active {
  background-color: rgba(0, 0, 0, 0.2);
}

.icon-button i {
  font-size: 0.8rem;
  color: darkgray;
}

.icon-button:hover i {
  color: black;
}

.icon-button:active i {
  color: black;
}

/* Prevent border flickering on table re-render */
.info-box table {
  border-collapse: collapse;
}

.info-box table td {
  border: 1px solid #e5e5e5;
}

.info-box table th {
  border: 1px solid #e5e5e5;
}


/* Ensure bestline row border is always visible */
.info-box table tbody tr:last-child td {
  border-top: 1px solid #e5e5e5 !important;
}

/* 기본 테이블 스타일 */
.info-table {
  background-color: #fff;
  line-height: 210%;
  table-layout: fixed;
  width: 100%;
  max-width: 600px;
  border-collapse: collapse;
  font-size: 120%; /* 폰트 크기 120% 증가 */
}

.info-table th,
.info-table td {
  font-size: 120%; /* 폰트 크기 120% 증가 */
}

.table-container {
  border: 1px solid #e5e5e5;
  border-collapse: collapse;
  background-color: #fff;
}

.info-box-inner {
  max-width: 600px;
  margin: 0 auto;
}

.bestline-cell {
  height: 1.6em; /* 한 줄 높이: line-height만큼 */
  max-height: 1.6em;
  overflow-y: auto;
  width: 100%;
  max-width: 600px;
  border-top: 1px solid #e5e5e5;
  vertical-align: top;
  line-height: 1.6;
}

.bestline-content {
  padding: 0;
  overflow-wrap: break-word;
  word-break: break-all;
  line-height: 1.6;
  display: block;
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
}

.position-group {
  max-width: 600px;
}

.position-textarea {
  padding: 5px 12px;
  height: 80px;
  width: 100%;
  overflow-y: auto;
  box-sizing: border-box;
  resize: none;
}

/* 스마트폰 반응형 스타일 */
@media (max-width: 767px) {
  /* 버튼 박스 스타일 */
  .button-box.mobile {
    display: flex;
    justify-content: center;
    margin: 5px auto;
  }

  .button-box-inner {
    width: auto !important;
    max-width: 100%;
  }

  .mobile-button {
    padding: 4px 18px !important;
    min-width: 60px !important;
    height: auto !important;
    font-size: 14px !important;
    line-height: 1.2 !important;
  }

  .mobile-button i {
    font-size: 18px !important;
  }

  /* Info box 스타일 - 가운데 정렬 */
  .info-box.mobile {
    display: block !important;
    margin-left: auto !important;
    margin-right: auto !important;
    max-width: 100% !important;
    padding: 5px 5px !important;
    margin-top: 5px !important;
    width: 100% !important;
    box-sizing: border-box !important;
  }

  .info-box-inner.mobile {
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 auto !important;
    padding: 0 5px !important;
    box-sizing: border-box !important;
  }

  /* 테이블 컨테이너 */
  .table-container.mobile {
    width: 100% !important;
    max-width: 100% !important;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* 테이블 스타일 */
  .info-table.mobile {
    width: 100% !important;
    max-width: 100% !important;
    font-size: 14.4px !important; /* 12px * 120% */
    line-height: 1.5 !important;
  }

  .info-table.mobile th,
  .info-table.mobile td {
    padding: 6px 4px !important;
    font-size: 13.2px !important; /* 11px * 120% */
    vertical-align: middle !important; /* 모든 행에 위아래 가운데 정렬 */
  }

  /* 스마트폰에서 모든 행의 높이를 1줄로 고정 */
  .info-table.mobile tbody tr td {
    height: 1.6em !important;
    max-height: 1.6em !important;
    line-height: 1.6 !important;
  }

  /* 단일 분석 모드 - 열 너비 조정 */
  .info-table.mobile thead tr th:first-child,
  .info-table.mobile tbody tr td:first-child {
    width: 50px !important;
    min-width: 50px !important;
    max-width: 50px !important;
  }

  .info-table.mobile thead tr th:nth-child(2),
  .info-table.mobile tbody tr td:nth-child(2) {
    width: 60px !important;
    min-width: 60px !important;
    max-width: 60px !important;
  }

  .info-table.mobile thead tr th:nth-child(3),
  .info-table.mobile tbody tr td:nth-child(3) {
    width: 50px !important;
    min-width: 50px !important;
    max-width: 50px !important;
  }

  .info-table.mobile thead tr th:nth-child(4),
  .info-table.mobile tbody tr td:nth-child(4) {
    width: 50px !important;
    min-width: 50px !important;
    max-width: 50px !important;
  }

  .info-table.mobile thead tr th:nth-child(5),
  .info-table.mobile tbody tr td:nth-child(5) {
    width: 50px !important;
    min-width: 50px !important;
    max-width: 50px !important;
  }

  /* Bestline 행 - 한 줄 높이로 고정 */
  .bestline-cell.mobile,
  .info-table.mobile tbody tr:last-child td,
  .info-table.mobile tbody tr td.bestline-cell {
    height: 1.6em !important;
    max-height: 1.6em !important;
    font-size: inherit !important;
    padding: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    vertical-align: middle !important; /* 가운데 정렬 */
    line-height: 1.6 !important;
  }

  .bestline-content {
    padding: 0 !important;
    line-height: 1.6 !important;
    display: block !important;
    width: 100% !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    white-space: nowrap !important;
  }

  /* 다중 분석 모드 - 열 너비 조정 */
  .info-table.mobile thead tr th[style*="width: 100px"] {
    width: 70px !important;
    min-width: 70px !important;
    max-width: 70px !important;
  }

  .info-table.mobile tbody tr td[style*="width: 100px"] {
    width: 70px !important;
    min-width: 70px !important;
    max-width: 70px !important;
  }

  .info-table.mobile thead tr th[style*="width: 50px"] {
    width: 35px !important;
    min-width: 35px !important;
    max-width: 35px !important;
  }

  .info-table.mobile tbody tr td[style*="width: 50px"] {
    width: 35px !important;
    min-width: 35px !important;
    max-width: 35px !important;
  }

  .info-table.mobile thead tr th[style*="width: 80px"] {
    width: 55px !important;
    min-width: 55px !important;
    max-width: 55px !important;
  }

  .info-table.mobile tbody tr td[style*="width: 80px"] {
    width: 55px !important;
    min-width: 55px !important;
    max-width: 55px !important;
  }

  /* Bestline 열 (마지막 열) */
  .info-table.mobile thead tr th:last-child,
  .info-table.mobile tbody tr td:last-child {
    width: auto !important;
    min-width: 0 !important;
    max-width: none !important;
  }

  /* Position group */
  .position-group.mobile {
    max-width: 100% !important;
    margin: 10px 5px !important;
  }

  .position-textarea.mobile {
    padding: 5px 8px !important;
    height: 70px !important;
    width: 100% !important;
    font-size: 12px !important;
    box-sizing: border-box !important;
    resize: none !important;
  }
}

</style>
