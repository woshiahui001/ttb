import { io, type Socket } from "socket.io-client"

interface GameState {
  currentSentence: string
  currentPlayerIndex: number
  players: Player[]
  gameStarted: boolean
  round: number
  lastMove: {
    playerId: string
    playerName: string
    addedWord: string
    position: number
  } | null
  evaluations: Evaluation[]
  showEvaluationPhase: boolean
  roomId: string
}

interface Player {
  id: string
  name: string
  isHost: boolean
}

interface Evaluation {
  playerId: string
  playerName: string
  type: "egg" | "flower" | "poop" | "kiss"
}

class GameSocket {
  private socket: Socket | null = null
  private callbacks: { [key: string]: Function[] } = {}

  connect() {
    // 在实际部署时，这里应该是你的服务器地址
    this.socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "ws://localhost:3001")

    this.socket.on("connect", () => {
      console.log("Connected to game server")
    })

    this.socket.on("disconnect", () => {
      console.log("Disconnected from game server")
    })

    // 监听游戏事件
    this.socket.on("gameStateUpdate", (gameState: GameState) => {
      this.emit("gameStateUpdate", gameState)
    })

    this.socket.on("playerJoined", (player: Player) => {
      this.emit("playerJoined", player)
    })

    this.socket.on("playerLeft", (playerId: string) => {
      this.emit("playerLeft", playerId)
    })

    this.socket.on("evaluationAdded", (evaluation: Evaluation) => {
      this.emit("evaluationAdded", evaluation)
    })
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // 加入房间
  joinRoom(roomId: string, playerName: string) {
    if (this.socket) {
      this.socket.emit("joinRoom", { roomId, playerName })
    }
  }

  // 创建房间
  createRoom(playerName: string) {
    if (this.socket) {
      this.socket.emit("createRoom", { playerName })
    }
  }

  // 开始游戏
  startGame(roomId: string, customTopic?: string) {
    if (this.socket) {
      this.socket.emit("startGame", { roomId, customTopic })
    }
  }

  // 添加字
  addWord(roomId: string, word: string, position: number) {
    if (this.socket) {
      this.socket.emit("addWord", { roomId, word, position })
    }
  }

  // 添加评价
  addEvaluation(roomId: string, type: string) {
    if (this.socket) {
      this.socket.emit("addEvaluation", { roomId, type })
    }
  }

  // 重置游戏
  resetGame(roomId: string) {
    if (this.socket) {
      this.socket.emit("resetGame", { roomId })
    }
  }

  // 事件监听
  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = []
    }
    this.callbacks[event].push(callback)
  }

  // 移除事件监听
  off(event: string, callback: Function) {
    if (this.callbacks[event]) {
      this.callbacks[event] = this.callbacks[event].filter((cb) => cb !== callback)
    }
  }

  // 触发事件
  private emit(event: string, data: any) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((callback) => callback(data))
    }
  }
}

export const gameSocket = new GameSocket()
