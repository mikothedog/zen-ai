#!/usr/bin/env bash
set -e

echo "==> Installing dependencies..."
if command -v pacman &>/dev/null; then
  sudo pacman -S --noconfirm go webkit2gtk-4.1
fi

echo "==> Building zen-ai..."
cd "$(dirname "$0")"
go build -mod=vendor -o zen-ai .

echo "==> Installing binary to /usr/local/bin..."
sudo cp zen-ai /usr/local/bin/zen-ai

echo "==> Creating rofi launcher..."
mkdir -p ~/.config/rofi/scripts
cat > ~/.config/rofi/scripts/zen-ai.sh << 'EOF'
#!/usr/bin/env bash
set -e
if pgrep -x rofi > /dev/null 2>&1; then
  pkill rofi
  exit 0
fi
INPUT=$(rofi -dmenu -p "Ask AI" -l 0)
[ -z "$INPUT" ] && exit 0
zen-ai "$INPUT"
EOF
chmod +x ~/.config/rofi/scripts/zen-ai.sh

echo ""
echo "==> Done. Add this to your Hyprland keybinds:"
echo ""
echo "    hl.bind(SUPER .. \" + A\", hl.dsp.exec_cmd(\"~/.config/rofi/scripts/zen-ai.sh\"))"
echo ""
