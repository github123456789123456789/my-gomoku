<template>
  <div class="board">
    <div class="board-stage" :style="canvasStyle">
      <canvas id="board" ref="canvasBoard" :width="renderWidth" :height="renderHeight"></canvas>
      <canvas id="piece" ref="canvasPiece" :width="renderWidth" :height="renderHeight"></canvas>
      <canvas id="realtime" ref="canvasRealtime" class="needsclick" :width="renderWidth" :height="renderHeight"
        @contextmenu.prevent @mousedown="onMouseDown" @touchstart="onMouseDown"></canvas>
      <canvas id="shot" ref="canvasJpg" :width="2048" :height="(2048 * canvasHeight) / canvasWidth"></canvas>
      <canvas id="shot" ref="canvasGif" :width="1024" :height="(1024 * canvasHeight) / canvasWidth"></canvas>
    </div>
  </div>
</template>

<script>
import { throttle, debounce } from 'throttle-debounce'
import { mapState, mapGetters } from 'vuex'

const paddingTop = 10,
  paddingBottom = 26
const paddingX = 26

function hexToRgba(sHex, alpha = 1) {
  // 十六进制颜色值的正则表达式
  let reg = /^#([0-9a-fA-f]{3}|[0-9a-fA-f]{6})$/
  /* 16进制颜色转为RGB格式 */
  let sColor = sHex.toLowerCase()
  if (sColor && reg.test(sColor)) {
    if (sColor.length === 4) {
      let sColorNew = '#'
      for (let i = 1; i < 4; i += 1) {
        sColorNew += sColor.slice(i, i + 1).concat(sColor.slice(i, i + 1))
      }
      sColor = sColorNew
    }
    // 处理六位的颜色值
    let sColorChange = []
    for (let i = 1; i < 7; i += 2) {
      sColorChange.push(parseInt('0x' + sColor.slice(i, i + 2)))
    }
    // return sColorChange.join(',')
    // 或
    return 'rgba(' + sColorChange.join(',') + ',' + alpha + ')'
  } else {
    return sColor
  }
}

function fillCircle(ctx, x, y, r) {
  const PI2 = 2 * Math.PI
  ctx.beginPath()
  ctx.arc(x, y, r, 0, PI2)
  ctx.fill()
}

function drawBackground(ctx, style, w, h, noShadow) {
  ctx.save()
  if (!noShadow) {
    ctx.shadowOffsetX = ctx.shadowOffsetY = 2
    ctx.shadowBlur = paddingX / 2
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
  }
  ctx.fillStyle = style.boardColor
  ctx.fillRect(paddingX, paddingTop, w - paddingX * 2, h - paddingBottom - paddingTop)
  ctx.restore()
}

function drawCoord(ctx, style, w, h, s, cs) {
  ctx.save()
  ctx.font = style.coordFontStyle + ' ' + Math.min(20, cs * 0.6) + 'px ' + style.coordFontFamily
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = style.coordColor

  // 左侧坐标
  ctx.save()
  ctx.translate(paddingX / 2, paddingTop + cs / 2)
  for (let i = 0; i < s; i++) {
    ctx.fillText(s - i, 0, cs * i, paddingX)
  }

  // 右侧坐标
  ctx.translate(w - paddingX, 0)
  for (let i = 0; i < s; i++) {
    ctx.fillText(s - i, 0, cs * i, paddingX)
  }
  ctx.restore()

  // 底部坐标
  ctx.translate(paddingX + cs / 2, h - paddingBottom / 2)
  for (let i = 0; i < s; i++) {
    ctx.fillText(String.fromCharCode('A'.charCodeAt(0) + i), cs * i, 0)
  }

  ctx.restore()
}

function drawBoard(ctx, style, s, cs) {
  let si = s - 1

  ctx.save()
  ctx.strokeStyle = ctx.fillStyle = style.lineColor
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  // 网格线
  ctx.lineWidth = style.lineWidth
  ctx.beginPath()
  for (let i = 1; i < si; i++) {
    ctx.moveTo(i, 0)
    ctx.lineTo(i, si)
    ctx.moveTo(0, i)
    ctx.lineTo(si, i)
  }
  ctx.stroke()

  // 画边框
  ctx.lineWidth = style.lineWidth * 2.5
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(si, 0)
  ctx.lineTo(si, si)
  ctx.lineTo(0, si)
  ctx.closePath()
  ctx.stroke()

  // 画星位
  let starPad = Math.floor(s / 5)
  let starCenter = Math.floor(s / 2)
  let starRadius = style.starRadiusScale
  fillCircle(ctx, starPad, starPad, starRadius)
  fillCircle(ctx, si - starPad, starPad, starRadius)
  fillCircle(ctx, starPad, si - starPad, starRadius)
  fillCircle(ctx, si - starPad, si - starPad, starRadius)
  fillCircle(ctx, starCenter, starCenter, starRadius)

  ctx.restore()
}

function drawPiece(ctx, style, cs, position, end) {
  let radius = style.pieceScale / 2
  ctx.save()
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  ctx.lineWidth = style.pieceStrokeWidth
  ctx.fillStyle = style.pieceBlack
  ctx.strokeStyle = style.pieceStrokeBlack

  end = Math.min(end, position.length)
  for (let i = 0; i < end; i += 2) {
    let pos = position[i]
    fillCircle(ctx, pos[0], pos[1], radius)
    if (style.pieceStrokeWidth > 0) ctx.stroke()
  }

  ctx.fillStyle = style.pieceWhite
  ctx.strokeStyle = style.pieceStrokeWhite
  for (let i = 1; i < end; i += 2) {
    let pos = position[i]
    fillCircle(ctx, pos[0], pos[1], radius)
    if (style.pieceStrokeWidth > 0) ctx.stroke()
  }

  ctx.restore()
}

function drawIndex(ctx, style, cs, position, end, startIndex, highlight) {
  ctx.save()
  ctx.font = style.indexFontStyle + ' ' + style.indexScale * cs + 'px ' + style.indexFontFamily
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)

  end = Math.min(end, position.length)
  for (let i = startIndex; i < end - 1; i += 1) {
    let pos = position[i]
    let text = i - startIndex + 1
    ctx.fillStyle = i % 2 == 0 ? style.indexColorBlack : style.indexColorWhite
    ctx.fillText(text, cs * pos[0], cs * pos[1], cs)
  }

  if (end > startIndex) {
    let pos = position[end - 1]
    if (highlight) ctx.fillStyle = style.lastStepColor
    else ctx.fillStyle = end % 2 == 1 ? style.indexColorBlack : style.indexColorWhite
    ctx.fillText(end - startIndex, cs * pos[0], cs * pos[1], cs)
  }

  ctx.restore()
}

function drawLastStep(ctx, style, cs, position, end) {
  end = Math.min(end, position.length)
  if (end <= 0) return
  ctx.save()
  ctx.fillStyle = style.lastStepColor
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)
  let pos = position[end - 1]
  fillCircle(ctx, pos[0], pos[1], style.lastStepScale)
  ctx.restore()
}

function drawWinline(ctx, style, cs, winline) {
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = style.winlineColor
  ctx.lineWidth = style.winlineWidth
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  ctx.beginPath()
  ctx.moveTo(winline[0][0], winline[0][1])
  ctx.lineTo(winline[1][0], winline[1][1])
  ctx.stroke()

  ctx.restore()
}

// eval 값을 비교 가능한 값으로 변환하는 함수 (mate 상황 처리 포함)
// 반환값: { value: 비교값, isMate: true/false, mateType: '+M'/'-M'/null, mateNum: 숫자 }
function parseEval(evalStr) {
  if (!evalStr || evalStr === '-') return null
  
  // +M1, -M1 같은 mate 상황 처리
  if (evalStr.startsWith('+M')) {
    const mateNum = parseInt(evalStr.substring(2))
    return {
      value: 100000 - mateNum, // 숫자가 작을수록 큰 값 (더 빠른 승리)
      isMate: true,
      mateType: '+M',
      mateNum: mateNum
    }
  } else if (evalStr.startsWith('-M')) {
    const mateNum = parseInt(evalStr.substring(2))
    return {
      value: -100000 + mateNum, // 숫자가 클수록 큰 값 (더 늦은 패배)
      isMate: true,
      mateType: '-M',
      mateNum: mateNum
    }
  }
  
  // 숫자로 변환 시도
  const num = parseFloat(evalStr)
  return isNaN(num) ? null : {
    value: num,
    isMate: false,
    mateType: null,
    mateNum: null
  }
}

// eval 비교 함수 (mate 상황 고려)
function compareEval(eval1, eval2) {
  if (!eval1 && !eval2) return 0
  if (!eval1) return -1
  if (!eval2) return 1
  
  // 둘 다 mate인 경우
  if (eval1.isMate && eval2.isMate) {
    if (eval1.mateType === '+M' && eval2.mateType === '+M') {
      // +M끼리는 숫자가 작을수록 좋음
      return eval2.mateNum - eval1.mateNum
    } else if (eval1.mateType === '-M' && eval2.mateType === '-M') {
      // -M끼리는 숫자가 클수록 좋음
      return eval1.mateNum - eval2.mateNum
    } else if (eval1.mateType === '+M' && eval2.mateType === '-M') {
      // +M이 -M보다 항상 좋음
      return 1
    } else {
      // -M이 +M보다 항상 나쁨
      return -1
    }
  }
  
  // 하나만 mate인 경우
  if (eval1.isMate && eval1.mateType === '+M') return 1
  if (eval1.isMate && eval1.mateType === '-M') return -1
  if (eval2.isMate && eval2.mateType === '+M') return -1
  if (eval2.isMate && eval2.mateType === '-M') return 1
  
  // 둘 다 일반 eval인 경우
  return eval1.value - eval2.value
}

function drawRealtime(ctx, style, cs, moves, position, pv, nbest) {
  if (!pv || pv.length === 0) return
  
  // 표시할 후보 수 결정 (pv 배열에 있는 모든 후보 표시)
  // nbest는 엔진에게 계산하라고 지시하는 수이고, 실제 표시는 pv 배열의 모든 후보를 표시
  const candidateCount = pv.length
  
  console.log('[DEBUG] drawRealtime: pv.length =', pv.length, 'nbest =', nbest, 'candidateCount =', candidateCount)
  
  // 최고 eval 값 찾기 (mate 상황 고려)
  let bestEval = null
  for (let i = 0; i < candidateCount; i++) {
    if (!pv[i] || !pv[i].eval) continue
    const evalObj = parseEval(pv[i].eval)
    if (evalObj !== null) {
      if (bestEval === null || compareEval(evalObj, bestEval) > 0) {
        bestEval = evalObj
      }
    }
  }
  
  // 겹쳐지는 것을 방지하기 위해 이미 그린 위치 추적
  const drawnPositions = new Set()
  
  ctx.save()
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  // 바둑돌과 같은 크기의 동그라미 그리기
  let radius = style.pieceScale / 2
  
  // 여러 후보를 역순으로 그리기 (나중에 그린 것이 위에 표시되도록)
  for (let i = candidateCount - 1; i >= 0; i--) {
    if (!pv[i] || !pv[i].bestline || pv[i].bestline.length === 0) {
      console.log('[DEBUG] drawRealtime: Skipping pv[' + i + '] - no bestline')
      continue
    }
    
    let candidatePos = pv[i].bestline[0]
    const posKey = `${candidatePos[0]},${candidatePos[1]}`
    
    // Check if this position is already occupied by a stone
    const isOccupied = position.some(existingPos => existingPos[0] === candidatePos[0] && existingPos[1] === candidatePos[1])
    if (isOccupied) {
      console.log('[DEBUG] drawRealtime: Skipping pv[' + i + '] at', candidatePos, '- position occupied')
      continue
    }
    
    // 겹쳐지는 것을 방지: 이미 그린 위치는 건너뛰기
    if (drawnPositions.has(posKey)) {
      console.log('[DEBUG] drawRealtime: Skipping pv[' + i + '] at', candidatePos, '- already drawn')
      continue
    }
    
    // eval 값을 비교하여 최고 점수인지 확인
    const evalObj = parseEval(pv[i].eval)
    const isBest = (evalObj !== null && bestEval !== null && compareEval(evalObj, bestEval) === 0)
    
    console.log('[DEBUG] drawRealtime: Drawing pv[' + i + '] at', candidatePos, 'eval =', pv[i].eval, 'isBest =', isBest)
    
    // 최고 점수(같은 점수 포함)는 빨간색, 나머지는 파란색
    if (isBest) {
      ctx.fillStyle = style.bestMoveColor // 빨간색 (최고수)
    } else {
      ctx.fillStyle = style.thoughtMoveColor // 파란색 (나머지)
    }
    
    fillCircle(ctx, candidatePos[0], candidatePos[1], radius)
    drawnPositions.add(posKey) // 그린 위치 기록
  }

  ctx.restore()
  
  // eval 텍스트 그리기 (스케일 적용 전에 그리기)
  ctx.save()
  ctx.font = style.indexFontStyle + ' ' + (style.indexScale * cs * 0.8) + 'px ' + style.indexFontFamily
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  
  // 여러 후보의 eval 텍스트 그리기 (겹침 방지)
  const drawnTextPositions = new Set()
  for (let i = 0; i < candidateCount; i++) {
    if (!pv[i] || !pv[i].bestline || pv[i].bestline.length === 0) continue
    
    let candidatePos = pv[i].bestline[0]
    const posKey = `${candidatePos[0]},${candidatePos[1]}`
    
    const isOccupied = position.some(existingPos => existingPos[0] === candidatePos[0] && existingPos[1] === candidatePos[1])
    if (isOccupied) continue
    
    // 겹쳐지는 것을 방지: 이미 텍스트를 그린 위치는 건너뛰기
    if (drawnTextPositions.has(posKey)) continue
    
    let evalValue = pv[i].eval || ''
    
    // eval 값이 있으면 흰색으로 표시
    if (evalValue) {
      ctx.fillStyle = style.indexColorBlack // 흰색
      ctx.fillText(evalValue, cs * candidatePos[0], cs * candidatePos[1], cs * 0.95)
      drawnTextPositions.add(posKey) // 텍스트를 그린 위치 기록
    }
  }
  
  ctx.restore()
}

function drawPvEval(ctx, showType, style, cs, pv) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  let halfcs = cs / 2
  let bgColor = hexToRgba(style.boardColor, style.pvEvalAlpha)
  ctx.translate(paddingX + halfcs, paddingTop + halfcs)

  for (let i = pv.length - 1; i >= 0; i -= 1) {
    if (pv[i].bestline && pv[i].bestline.length > 0) {
      let pos = pv[i].bestline[0]
      let x = cs * pos[0]
      let y = cs * pos[1]
      ctx.fillStyle = bgColor
      ctx.fillRect(x - halfcs, y - halfcs, cs, cs)
      ctx.fillStyle = i > 0 ? style.thoughtMoveColor : style.bestMoveColor

      ctx.font =
        style.pvEvalFontStyle + ' ' + style.pvEvalScale * cs + 'px ' + style.pvEvalFontFamily
      if (showType == 1) {
        ctx.fillText(pv[i].eval, x, y, cs * 0.95)
      } else if (showType == 2) {
        if (pv[i].winrate == 0.0 || pv[i].winrate == 1.0) ctx.fillText(pv[i].eval, x, y, cs * 0.95)
        else ctx.fillText((pv[i].winrate * 100).toFixed(1), x, y, cs * 0.95)
      } else {
        ctx.fillText(pv[i].eval, x, y - cs * 0.2, cs * 0.95)
        ctx.font =
          (style.pvEvalFontStyle * 2) / 3 +
          ' ' +
          style.pvEvalScale * cs * 0.8 +
          'px ' +
          style.pvEvalFontFamily
        ctx.fillText(pv[i].depth + '-' + pv[i].seldepth, x, y + cs * 0.2, cs * 0.95)
      }
    }
  }
}

function drawSelection(ctx, style, cs, pos) {
  ctx.save()
  ctx.strokeStyle = style.selectionStrokeColor
  ctx.lineWidth = style.selectionStrokeWidth
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  ctx.beginPath()
  ctx.moveTo(pos[0] - 0.5, pos[1] - 0.5)
  ctx.lineTo(pos[0] + 0.5, pos[1] - 0.5)
  ctx.lineTo(pos[0] + 0.5, pos[1] + 0.5)
  ctx.lineTo(pos[0] - 0.5, pos[1] + 0.5)
  ctx.closePath()
  ctx.stroke()

  ctx.restore()
}

function drawForbid(ctx, style, cs, forbid) {
  ctx.save()
  ctx.strokeStyle = style.forbidStrokeColor
  ctx.lineWidth = style.forbidStrokeWidth
  ctx.lineCap = 'round'
  ctx.translate(paddingX + cs / 2, paddingTop + cs / 2)
  ctx.scale(cs, cs)

  const CrossSize = 0.22

  for (let pos of forbid) {
    ctx.beginPath()
    ctx.moveTo(pos[0] - CrossSize, pos[1] - CrossSize)
    ctx.lineTo(pos[0] + CrossSize, pos[1] + CrossSize)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(pos[0] + CrossSize, pos[1] - CrossSize)
    ctx.lineTo(pos[0] - CrossSize, pos[1] + CrossSize)
    ctx.stroke()
  }

  ctx.restore()
}

export default {
  name: 'Board',
  props: {
    isAiTurn: Boolean,
    previewPv: Object,
  },
  data: function () {
    return {
      debouncedRedrawAllLayers: debounce(50, this.redrawAllLayers),
      throttledDrawRealtimeLayer: throttle(10, this.drawRealtimeLayer),
      selecting: false,
      selectedCoord: [0, 0],
      pressed: false,
      cancelMouse: false,
      ratioOverride: null,
      end: Infinity,
    }
  },
  computed: {
    ...mapState('position', {
      boardSize: 'size',
      position: 'position',
      winline: 'winline',
    }),
    ...mapState('settings', [
      'boardStyle',
      'indexOrigin',
      'showCoord',
      'showDetail',
      'showPvEval',
      'showWinrate',
      'showIndex',
      'showLastStep',
      'showWinline',
      'showForbid',
      'clickCheck',
      'nbest',
    ]),
    ...mapState('ai', {
      realtime: (state) => state.outputs.realtime,
      pv: (state) => state.outputs.pv,
      forbid: (state) => state.outputs.forbid,
      thinking: 'thinking',
    }),
    ...mapGetters('position', ['isInBoard']),
    context() {
      return (idx) => {
        return this.$refs['canvas' + idx].getContext('2d')
      }
    },
    canvasWidth() {
      return this.$store.getters.boardCanvasWidth
    },
    canvasHeight() {
      return this.canvasWidth - 2 * paddingX + paddingBottom + paddingTop
    },
    boardWidth() {
      return this.canvasWidth - 2 * paddingX
    },
    canvasStyle() {
      return {
        width: this.canvasWidth + 'px',
        height: this.canvasHeight + 'px',
      }
    },
    renderRatio() {
      // 屏幕的设备像素比(解决高DPI屏模糊问题)
      return this.ratioOverride || window.devicePixelRatio || 1
    },
    renderWidth() {
      return this.canvasWidth * this.renderRatio
    },
    renderHeight() {
      return this.canvasHeight * this.renderRatio
    },
  },
  methods: {
    drawBoardLayer(ctx, noclear) {
      ctx = ctx || this.context('Board')
      let width = this.canvasWidth
      let height = this.canvasHeight
      let cellSize = this.boardWidth / this.boardSize

      ctx.save()
      ctx.scale(this.renderRatio, this.renderRatio)
      if (!noclear) ctx.clearRect(0, 0, width, height)

      drawBackground(ctx, this.boardStyle, width, height, noclear)
      if (this.showCoord) drawCoord(ctx, this.boardStyle, width, height, this.boardSize, cellSize)
      drawBoard(ctx, this.boardStyle, this.boardSize, cellSize)

      ctx.restore()
    },
    drawPieceLayer(ctx, noclear) {
      ctx = ctx || this.context('Piece')
      let cellSize = this.boardWidth / this.boardSize
      ctx.save()
      ctx.scale(this.renderRatio, this.renderRatio)
      if (!noclear) ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

      if (this.previewPv) {
        let previewPosition = this.previewPv.position.concat(this.previewPv.pv)
        drawPiece(ctx, this.boardStyle, cellSize, previewPosition, Infinity)
        drawIndex(
          ctx,
          this.boardStyle,
          cellSize,
          previewPosition,
          Infinity,
          this.previewPv.position.length,
          this.showLastStep
        )
      } else {
        drawPiece(ctx, this.boardStyle, cellSize, this.position, this.end)
        if (this.showWinline && this.winline.length > 0 && this.end >= this.position.length)
          drawWinline(ctx, this.boardStyle, cellSize, this.winline)
        if (this.showIndex)
          drawIndex(
            ctx,
            this.boardStyle,
            cellSize,
            this.position,
            this.end,
            this.indexOrigin,
            this.showLastStep
          )
        else if (this.showLastStep)
          drawLastStep(ctx, this.boardStyle, cellSize, this.position, this.end)
      }

      ctx.restore()
    },
    drawRealtimeLayer(ctx, noclear) {
      ctx = ctx || this.context('Realtime')
      let cellSize = this.boardWidth / this.boardSize
      ctx.save()
      ctx.scale(this.renderRatio, this.renderRatio)
      if (!noclear) ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

      // Always show forbid marks when enabled, regardless of thinking state
      if (this.showForbid && !this.previewPv) {
        drawForbid(ctx, this.boardStyle, cellSize, this.forbid)
      }

      if (this.selecting) drawSelection(ctx, this.boardStyle, cellSize, this.selectedCoord)
      else if (!this.previewPv) {
        if (this.showDetail) drawRealtime(ctx, this.boardStyle, cellSize, this.realtime, this.position, this.pv, this.nbest)
        if (this.showPvEval > 0 && this.pv.length > 0 && this.thinking)
          drawPvEval(ctx, this.showPvEval, this.boardStyle, cellSize, this.pv)
      }

      ctx.restore()
    },
    redrawAllLayers(ctx, noclear) {
      this.drawBoardLayer(ctx, noclear)
      this.drawPieceLayer(ctx, noclear)
      this.drawRealtimeLayer(ctx, noclear)
    },
    screenshot() {
      this.ratioOverride = 2048 / this.canvasWidth
      let ctx = this.context('Jpg')
      ctx.save()
      ctx.scale(this.renderRatio, this.renderRatio)
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
      ctx.restore()

      this.redrawAllLayers(ctx, true)
      this.ratioOverride = null
      return ctx.canvas.toDataURL('image/jpeg')
    },
    exportGIF(startIndex, delay, callback) {
      let ctx = this.context('Gif')
      this.ratioOverride = ctx.canvas.width / this.canvasWidth
      // eslint-disable-next-line
      let gif = new GIF({
        workers: 8,
        quality: 2,
        width: ctx.canvas.width,
        height: ctx.canvas.height,
        workerScript: process.env.BASE_URL + 'lib/gif.worker.js',
      })

      for (this.end = startIndex; this.end <= this.position.length; this.end++) {
        ctx.save()
        ctx.fillStyle = '#FFFFFF'
        ctx.scale(this.renderRatio, this.renderRatio)
        ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)
        ctx.restore()
        this.drawBoardLayer(ctx, true)
        this.drawPieceLayer(ctx, true)
        gif.addFrame(ctx, { copy: true, delay: (this.end == this.position.length ? 3 : 1) * delay })
      }

      this.end = Infinity
      this.ratioOverride = null

      gif.on('finished', callback)
      gif.render()
    },
    onMouseDown(event) {
      if (this.clickCheck == 2) {
        if (event.type === 'touchstart') {
          this.cancelMouse = true
          event.button = 0
          if (!event.pageX) event.pageX = event.touches[0].pageX
          if (!event.pageY) event.pageY = event.touches[0].pageY
        } else if (this.cancelMouse) {
          this.cancelMouse = false
          return
        }
      }

      let x = event.pageX - this.$refs.canvasBoard.getBoundingClientRect().left
      let y = event.pageY - this.$refs.canvasBoard.getBoundingClientRect().top
      let cellSize = this.boardWidth / this.boardSize
      x = Math.floor((x - paddingX) / cellSize)
      y = Math.floor((y - paddingTop) / cellSize)

      if (event.button != 0) {
        this.$emit('clicked', { x, y, button: event.button })
        return
      } else if (this.winline.length > 0) return

      if (this.clickCheck == 0 || this.isAiTurn)
        this.$emit('clicked', { x, y, button: event.button })
      else if (this.clickCheck == 1) {
        if (this.selecting) {
          let dx = Math.abs(x - this.selectedCoord[0])
          let dy = Math.abs(y - this.selectedCoord[1])
          if (Math.max(dx, dy) <= 1)
            this.$emit('clicked', {
              x: this.selectedCoord[0],
              y: this.selectedCoord[1],
              button: event.button,
            })
        } else {
          this.selectedCoord = [x, y]
        }
        this.selecting = !this.selecting
      } else if (this.clickCheck == 2) {
        this.pressed = true
        this.selectedCoord = [x, y - 2]
        this.selecting = this.isInBoard(this.selectedCoord)
      }
    },
    onMouseUp(event) {
      if (!this.pressed) return

      if (event.type === 'touchend') {
        event.preventDefault()
        event.button = 0
      }

      this.$emit('clicked', {
        x: this.selectedCoord[0],
        y: this.selectedCoord[1],
        button: event.button,
      })

      this.selecting = false
      this.pressed = false
    },
    onMouseMove(event) {
      if (!this.pressed) return

      if (event.type === 'touchmove') {
        event.preventDefault()
        event.button = 0
        if (!event.pageX) event.pageX = event.touches[0].pageX
        if (!event.pageY) event.pageY = event.touches[0].pageY
      }

      let x = event.pageX - this.$refs.canvasBoard.getBoundingClientRect().left
      let y = event.pageY - this.$refs.canvasBoard.getBoundingClientRect().top
      let cellSize = this.boardWidth / this.boardSize
      x = Math.floor((x - paddingX) / cellSize)
      y = Math.floor((y - paddingTop) / cellSize)

      let oldCoord = this.selectedCoord
      this.selectedCoord = [x, y - 2]
      this.selecting = this.isInBoard(this.selectedCoord)

      if (
        this.selecting &&
        (oldCoord[0] != this.selectedCoord[0] || oldCoord[1] != this.selectedCoord[1])
      ) {
        this.throttledDrawRealtimeLayer()
      }
    },
  },
  watch: {
    '$store.state.screenWidth': function () {
      this.debouncedRedrawAllLayers()
    },
    '$store.state.screenHeight': function () {
      this.debouncedRedrawAllLayers()
    },
    boardSize() {
      this.debouncedRedrawAllLayers()
    },
    position: {
      handler() {
        this.drawPieceLayer()
      },
      deep: true,
    },
    realtime: {
      handler(newVal, oldVal) {
        // Always redraw when realtime changes, especially when best move is cleared
        if (this.showDetail) {
          this.drawRealtimeLayer()
        } else {
          // Even if showDetail is false, clear the canvas if best move was cleared
          if (oldVal && newVal && 
              (oldVal.best && oldVal.best.length > 0 && newVal.best && newVal.best.length === 0)) {
            this.drawRealtimeLayer()
          }
        }
      },
      deep: true,
      immediate: false,
    },
    pv: {
      handler() {
        if (this.showPvEval > 0) this.throttledDrawRealtimeLayer()
      },
      deep: true,
    },
    forbid() {
      if (this.showForbid) this.drawRealtimeLayer()
    },
    previewPv() {
      this.drawPieceLayer()
      this.drawRealtimeLayer()
    },
    indexOrigin() {
      this.drawPieceLayer()
    },
    showCoord() {
      this.drawBoardLayer()
    },
    showDetail() {
      this.drawRealtimeLayer()
    },
    showPvEval() {
      this.drawRealtimeLayer()
    },
    showIndex() {
      this.drawPieceLayer()
    },
    showLastStep() {
      this.drawPieceLayer()
    },
    showWinline() {
      this.drawPieceLayer()
    },
    showForbid() {
      this.drawRealtimeLayer()
    },
    selecting() {
      this.throttledDrawRealtimeLayer()
    },
    boardStyle: {
      handler() {
        this.debouncedRedrawAllLayers()
      },
      deep: true,
    },
  },
  mounted() {
    this.redrawAllLayers()
    window.addEventListener('mousemove', throttle(50, this.onMouseMove))
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('touchmove', throttle(50, this.onMouseMove), {
      passive: false,
    })
    window.addEventListener('touchend', this.onMouseUp, { passive: false })
  },
}
</script>

<style lang="less" scoped>
.board {
  width: 100%;
}

.board-stage {
  position: relative;
  margin: 0 auto;
}

canvas {
  position: absolute;
  width: 100%;
  height: 100%;
  touch-action: none;
}

#board {
  z-index: 1;
}

#piece {
  z-index: 2;
}

#realtime {
  z-index: 3;
}

#shot {
  z-index: -1;
  display: none;
}
</style>
