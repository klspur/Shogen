import tkinter as tk
import random

# 玩家類別
class Player:
    def __init__(self, name):
        self.name = name
        self.position = 0
        self.drinks = 0

    def move(self, steps, board_size):
        self.position = (self.position + steps) % board_size

    def drink(self, amount):
        self.drinks += amount

# 主遊戲類別
class DrunkMonopolyGame:
    def __init__(self, root, player_names):
        if not player_names:
            raise ValueError("⚠️ 玩家名單不可為空，請至少加入一位玩家！")
        self.root = root
        self.root.title("酒精大富翁（簡易 GUI）")
        self.players = [Player(name) for name in player_names]
        self.current_player_index = 0
        self.board = self.create_board()
        self.log_text = tk.StringVar()
        self.setup_ui()

    def setup_ui(self):
        tk.Label(self.root, text="🎉 歡迎來到 酒精大富翁！", font=("Arial", 16)).pack(pady=10)

        self.status_label = tk.Label(self.root, textvariable=self.log_text, font=("Arial", 12), justify="left", wraplength=480)
        self.status_label.pack(pady=10)

        self.roll_button = tk.Button(self.root, text="🎲 擲骰子", font=("Arial", 14), command=self.play_turn)
        self.roll_button.pack(pady=10)

        self.update_status(f"👉 遊戲開始！輪到 {self.players[self.current_player_index].name} 擲骰")

    def create_board(self):
        return [
            ("起點：免費暢飲", lambda p: p.drink(0)),
            ("朋友請你喝一杯", lambda p: p.drink(1)),
            ("不小心摔倒，多喝 2 杯", lambda p: p.drink(2)),
            ("瞬移回起點", lambda p: setattr(p, 'position', 0)),
            ("抽卡：喝一杯或讓下一位喝兩杯", self.draw_card),
            ("你請大家喝酒，你喝 2 杯", lambda p: p.drink(2)),
            ("幸運地帶，跳過喝酒", lambda p: None),
            ("你醉了，喝 3 杯清醒一下", lambda p: p.drink(3)),
        ]

    def draw_card(self, player):
        choice = random.choice(["self", "next"])
        if choice == "self":
            player.drink(1)
            return f"{player.name} 抽卡：選擇自己喝 1 杯。"
        else:
            next_player = self.players[(self.current_player_index + 1) % len(self.players)]
            next_player.drink(2)
            return f"{player.name} 抽卡：讓 {next_player.name} 喝 2 杯！"

    def play_turn(self):
        # 防呆：確認玩家索引合法
        if not self.players:
            self.update_status("錯誤：沒有玩家，遊戲無法繼續。")
            return

        if self.current_player_index >= len(self.players):
            self.current_player_index = 0

        player = self.players[self.current_player_index]
        dice = random.randint(1, 6)
        player.move(dice, len(self.board))
        tile_desc, tile_action = self.board[player.position]

        extra_message = ""
        drinks_before = player.drinks

        if callable(tile_action):
            result = tile_action(player)
            drinks_after = player.drinks
            drinks_diff = drinks_after - drinks_before

            if isinstance(result, str):
                extra_message = result
            elif drinks_diff > 0:
                extra_message = f"{player.name} 喝了 {drinks_diff} 杯。"
            else:
                extra_message = f"{player.name} 安然無恙～"

        self.update_status(
            f"{player.name} 擲出 {dice} 點，來到第 {player.position} 格\n"
            f"➡️ 「{tile_desc}」\n{extra_message}"
        )

        # 換下一位（確保索引不會越界）
        self.current_player_index = (self.current_player_index + 1) % len(self.players)
        next_player = self.players[self.current_player_index]
        self.roll_button.config(text=f"🎲 輪到 {next_player.name} 擲骰")

    def update_status(self, message):
        all_status = "\n\n".join(
            [f"{p.name}：位置 {p.position}｜喝了 {p.drinks} 杯" for p in self.players]
        )
        self.log_text.set(f"{message}\n\n【玩家狀態】\n{all_status}")

# 啟動遊戲
if __name__ == "__main__":
    root = tk.Tk()
    player_names = ["伊娃科夫", "小楊生煎包", "狗狗"]  # 你可以自行調整玩家名稱
    game = DrunkMonopolyGame(root, player_names)
    root.mainloop()
