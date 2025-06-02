"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trophy, Star, RotateCcw, Copy, Share2, Crown } from "lucide-react"
import type { GameStats } from "@/lib/supabase"

const evaluationIcons = {
  egg: "🥚",
  flower: "🌸",
  poop: "💩",
  kiss: "💋",
}

const evaluationLabels = {
  egg: "鸡蛋",
  flower: "鲜花",
  poop: "狗屎",
  kiss: "飞吻",
}

interface GameEndScreenProps {
  roomId: string
  gameStats: GameStats
  onRestart: () => void
  onCopyLink: () => void
  onShare: () => void
  currentPlayerId: string
}

export function GameEndScreen({
  roomId,
  gameStats,
  onRestart,
  onCopyLink,
  onShare,
  currentPlayerId,
}: GameEndScreenProps) {
  const { finalSentence, mvpPlayer, playerStats, totalMoves, gameHistory } = gameStats

  // 计算总评价统计
  const totalEvaluations = {
    egg: gameStats.allEvaluations.filter((e) => e.evaluation_type === "egg").length,
    flower: gameStats.allEvaluations.filter((e) => e.evaluation_type === "flower").length,
    poop: gameStats.allEvaluations.filter((e) => e.evaluation_type === "poop").length,
    kiss: gameStats.allEvaluations.filter((e) => e.evaluation_type === "kiss").length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 游戏结束标题 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-purple-800 mb-2">🎉 游戏结束！</h1>
          <p className="text-purple-600">句子已达到20字，让我们看看大家的表现吧！</p>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Badge variant="outline">房间号: {roomId}</Badge>
            <Button size="sm" variant="outline" onClick={onCopyLink}>
              <Copy className="w-3 h-3 mr-1" />
              复制链接
            </Button>
            <Button size="sm" variant="outline" onClick={onShare}>
              <Share2 className="w-3 h-3 mr-1" />
              分享
            </Button>
          </div>
        </div>

        {/* 最终句子展示 */}
        <Card className="border-2 border-purple-300 bg-purple-50">
          <CardHeader>
            <CardTitle className="text-center text-2xl text-purple-800">✨ 最终作品</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-900 bg-white rounded-lg p-6 shadow-sm">
                {finalSentence}
              </div>
              <p className="text-sm text-purple-600 mt-3">
                总共 {finalSentence.length} 个字 · {totalMoves} 次添加
              </p>
            </div>
          </CardContent>
        </Card>

        {/* MVP 玩家 */}
        {mvpPlayer && (
          <Card className="border-2 border-yellow-300 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-center text-xl text-yellow-800 flex items-center justify-center gap-2">
                <Trophy className="w-6 h-6" />🏆 MVP 玩家
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center space-y-3">
                <div className="flex items-center justify-center gap-2">
                  <Crown className="w-8 h-8 text-yellow-600" />
                  <span className="text-3xl font-bold text-yellow-800">{mvpPlayer.playerName}</span>
                  {mvpPlayer.playerId === currentPlayerId && <Badge className="bg-yellow-600">这就是你！</Badge>}
                </div>
                <div className="flex justify-center gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-700">{mvpPlayer.totalPositiveScore}</div>
                    <div className="text-sm text-yellow-600">评价分数</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-700">{mvpPlayer.wordsAdded}</div>
                    <div className="text-sm text-yellow-600">添加字数</div>
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  {Object.entries(mvpPlayer.evaluationsReceived).map(
                    ([type, count]) =>
                      count > 0 && (
                        <div key={type} className="flex items-center gap-1">
                          <span className="text-lg">{evaluationIcons[type as keyof typeof evaluationIcons]}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ),
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 评价统计总览 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">🎭 评价统计总览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              {Object.entries(totalEvaluations).map(([type, count]) => (
                <div key={type} className="text-center p-3 rounded-lg border border-gray-200">
                  <div className="text-3xl mb-2">{evaluationIcons[type as keyof typeof evaluationIcons]}</div>
                  <div className="text-2xl font-bold text-gray-800">{count}</div>
                  <div className="text-sm text-gray-600">{evaluationLabels[type as keyof typeof evaluationLabels]}</div>
                </div>
              ))}
            </div>
            <div className="text-center text-sm text-gray-600">
              总评价数：{Object.values(totalEvaluations).reduce((a, b) => a + b, 0)} 次
            </div>
          </CardContent>
        </Card>

        {/* 每个玩家的贡献 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">👥 玩家贡献排行</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {playerStats
                .sort((a, b) => b.totalPositiveScore - a.totalPositiveScore)
                .map((player, index) => (
                  <div
                    key={player.playerId}
                    className={`p-4 rounded-lg border-2 ${
                      player.playerId === currentPlayerId ? "border-blue-300 bg-blue-50" : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && <Trophy className="w-5 h-5 text-yellow-500" />}
                          {index === 1 && <Star className="w-5 h-5 text-gray-400" />}
                          {index === 2 && <Star className="w-5 h-5 text-amber-600" />}
                          <span className="text-lg font-bold">#{index + 1}</span>
                        </div>
                        <span className="text-xl font-semibold">{player.playerName}</span>
                        {player.playerId === currentPlayerId && <Badge className="bg-blue-600">你</Badge>}
                      </div>
                      {/* Display player score */}
                      <div className="text-right">
                        <div className="text-lg font-bold text-purple-700">{player.score}</div>
                        <div className="text-sm text-gray-600">总分数</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">+{player.totalPositiveScore}</div>
                        <div className="text-sm text-gray-600">评价分数</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600 mb-1">添加的字：</div>
                        <div className="text-lg font-medium">{player.wordsAdded} 个字</div>
                        {player.moves.length > 0 && (
                          <div className="text-sm text-gray-500 mt-1">
                            "{player.moves.map((m) => m.added_word).join('", "')}"
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-gray-600 mb-1">收到的评价：</div>
                        {/* 简化为一行显示 */}
                        <div className="flex items-center gap-2">
                          {Object.entries(player.evaluationsReceived).map(
                            ([type, count]) =>
                              count > 0 && (
                                <div key={type} className="flex items-center gap-1">
                                  <span className="text-sm">
                                    {evaluationIcons[type as keyof typeof evaluationIcons]}
                                  </span>
                                  <span className="text-sm font-medium">{count}</span>
                                </div>
                              ),
                          )}
                          {Object.values(player.evaluationsReceived).every((count) => count === 0) && (
                            <span className="text-gray-400 text-sm">暂无评价</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* 游戏历史 */}
        <Card>
          <CardHeader>
            <CardTitle>📜 游戏历程</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gameHistory.map((move, index) => (
                <div key={move.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Badge variant="outline">第{index + 1}步</Badge>
                  <span className="font-medium">{move.player_name}</span>
                  <span>添加了</span>
                  <span className="text-lg font-bold text-blue-600">"{move.added_word}"</span>
                  <span className="text-gray-500">→</span>
                  <span className="flex-1 text-gray-700">"{move.sentence_after}"</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 重新开始选项 */}
        <Card>
          <CardContent className="text-center p-6">
            <Button onClick={onRestart} size="lg" className="w-full max-w-md">
              <RotateCcw className="w-5 h-5 mr-2" />
              开始新游戏
            </Button>
            <p className="text-sm text-gray-600 mt-3">重新开始一局新的加字游戏</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
