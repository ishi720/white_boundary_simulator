# White Boundary Simulator（白の境界線シミュレータ）

「白は、どこまで白か。」をテーマにしたシミュレータです。
真っ白 `(255, 255, 255)` からのユークリッド距離

```
√((255-R)² + (255-G)² + (255-B)²)
```

が指定した距離以内に収まるRGB色が、全16,777,216色中いくつあるかを計算し、
スライダーで距離を変えながら対象の色をスウォッチとグラフで確認できます。

## イメージ

<img width="805" height="768" alt="image" src="https://github.com/user-attachments/assets/4daa4c2b-7ef6-4ef8-8fb7-8f00c7f05fc4" />

## 主な機能

- **距離スライダー**: 白からの距離（0 〜 √3×255）を指定し、条件を満たす色数をリアルタイムに集計
- **Swatches**: 該当する色を左上（白に近い）から右下（白から遠い）に並べて表示（400色を超える場合は間引き表示）
- **Count / グラフ**: 距離と色数の関係を折れ線グラフで可視化し、現在位置を赤線・赤点で表示
- **色数からの逆引き**（`jumpToTarget` / `find`）: 目標の色数を指定すると、それを満たす最小距離を二分探索で求める

## 技術構成

- 素のHTML/CSS/JavaScript + [Alpine.js](https://alpinejs.dev/) v3（`alpine.min.js` としてローカルに同梱、外部CDN不要）
- 重い距離計算はAlpineのリアクティブ管理外のプレーンJSで実行
  - 距離の2乗（`d²`）ごとの件数をヒストグラム化し、カウンティングソートで座標を距離順に並べ替え（`Array.sort` より高速）
  - 距離→色数の取得は二分探索（`countAt`）、色数→距離の逆引きも二分探索（`findMinDistForTarget`）

## ファイル構成

| ファイル | 内容 |
|---|---|
| `index.html` | ページ構造・Alpineディレクティブ |
| `app.js` | 距離計算のコアロジックとAlpineコンポーネント |
| `style.css` | スタイル |
| `alpine.min.js` | Alpine.js v3（ローカル同梱） |

## 使い方

1. このリポジトリをクローンまたはダウンロード
2. `index.html` をブラウザで開く

```bash
git clone <このリポジトリのURL>
cd white_boundary_simulator
# index.html をブラウザで開く
```
