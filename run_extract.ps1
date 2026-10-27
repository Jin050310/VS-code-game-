$source = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.IO;

public class AssetExtractor {
    public static void ExtractAll(string inputPath, string outputDir) {
        if (!Directory.Exists(outputDir)) {
            Directory.CreateDirectory(outputDir);
        }

        using (Bitmap src = new Bitmap(inputPath)) {
            // 1. Portraits
            SavePortrait(src, new Rectangle(17, 14, 252, 251), Path.Combine(outputDir, "pantheon.png"));
            SavePortrait(src, new Rectangle(17, 14, 252, 251), Path.Combine(outputDir, "hero_pantheon.png"));
            SavePortrait(src, new Rectangle(286, 14, 248, 251), Path.Combine(outputDir, "hero_mage.png"));
            SavePortrait(src, new Rectangle(549, 14, 251, 251), Path.Combine(outputDir, "hero_archer.png"));

            // 2. White background units
            // Soldier: 830..953 (W: 124)
            SaveWhiteUnit(src, new Rectangle(830, 37, 124, 222), Path.Combine(outputDir, "soldier.png"));
            // Mage Unit: 954..1103 (W: 150)
            SaveMageUnit(src, new Rectangle(954, 40, 150, 219), Path.Combine(outputDir, "mage_unit.png"));
            // Archer Unit: 1103..1235 (W: 133)
            SaveWhiteUnit(src, new Rectangle(1103, 40, 133, 219), Path.Combine(outputDir, "archer_unit.png"));

            // 3. Checkerboard units
            // Zombie: 1243..1390 (W: 147)
            SaveCheckerUnit(src, new Rectangle(1243, 35, 147, 225), Path.Combine(outputDir, "zombie.png"), false);
            // Viking Boss: Left=24, Top=317, Width=463, Height=427
            SaveCheckerUnit(src, new Rectangle(24, 317, 463, 427), Path.Combine(outputDir, "boss.png"), true);
            SaveCheckerUnit(src, new Rectangle(24, 317, 463, 427), Path.Combine(outputDir, "boss_viking.png"), true);

            // 4. Battlefield background
            SaveRect(src, new Rectangle(516, 311, 874, 444), Path.Combine(outputDir, "battlefield_bg.png"));
        }
        Console.WriteLine("All assets successfully extracted!");
    }

    private static void SaveRect(Bitmap src, Rectangle rect, string outputPath) {
        using (Bitmap crop = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb)) {
            using (Graphics g = Graphics.FromImage(crop)) {
                g.DrawImage(src, new Rectangle(0, 0, rect.Width, rect.Height), rect, GraphicsUnit.Pixel);
            }
            crop.Save(outputPath, ImageFormat.Png);
        }
        Console.WriteLine("Saved rect: " + outputPath);
    }

    private static void SavePortrait(Bitmap src, Rectangle rect, string outputPath) {
        using (Bitmap crop = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb)) {
            int w = rect.Width, h = rect.Height;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    crop.SetPixel(x, y, src.GetPixel(rect.X + x, rect.Y + y));
                }
            }

            bool[,] isBg = new bool[w, h];
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    Color c = crop.GetPixel(x, y);
                    if (c.R >= 225 && c.G >= 225 && c.B >= 225) {
                        isBg[x, y] = true;
                    }
                }
            }

            bool[,] visited = new bool[w, h];
            Queue<Point> q = new Queue<Point>();
            TryEnqueue(q, visited, isBg, 0, 0, w, h);
            TryEnqueue(q, visited, isBg, w - 1, 0, w, h);
            TryEnqueue(q, visited, isBg, 0, h - 1, w, h);
            TryEnqueue(q, visited, isBg, w - 1, h - 1, w, h);

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };
            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i], ny = p.Y + dy[i];
                    TryEnqueue(q, visited, isBg, nx, ny, w, h);
                }
            }

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (visited[x, y]) {
                        crop.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    }
                }
            }

            crop.Save(outputPath, ImageFormat.Png);
        }
        Console.WriteLine("Saved portrait: " + outputPath);
    }

    private static void SaveMageUnit(Bitmap src, Rectangle rect, string outputPath) {
        using (Bitmap crop = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb)) {
            int w = rect.Width, h = rect.Height;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    crop.SetPixel(x, y, src.GetPixel(rect.X + x, rect.Y + y));
                }
            }

            bool[,] isBg = new bool[w, h];
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    Color c = crop.GetPixel(x, y);
                    if (c.R >= 220 && c.G >= 220 && c.B >= 220) {
                        isBg[x, y] = true;
                    }
                    // Exclude Archer cape / bow on the right below the orb
                    if (x >= 140 && y >= 90) {
                        isBg[x, y] = true;
                    }
                }
            }

            bool[,] visited = new bool[w, h];
            Queue<Point> q = new Queue<Point>();
            for (int x = 0; x < w; x++) {
                TryEnqueue(q, visited, isBg, x, 0, w, h);
                TryEnqueue(q, visited, isBg, x, h - 1, w, h);
            }
            for (int y = 0; y < h; y++) {
                TryEnqueue(q, visited, isBg, 0, y, w, h);
                TryEnqueue(q, visited, isBg, w - 1, y, w, h);
            }

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };
            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i], ny = p.Y + dy[i];
                    TryEnqueue(q, visited, isBg, nx, ny, w, h);
                }
            }

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (visited[x, y]) {
                        crop.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    } else {
                        bool nearBg = false;
                        for (int i = 0; i < 4; i++) {
                            int nx = x + dx[i], ny = y + dy[i];
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h && visited[nx, ny]) {
                                nearBg = true;
                                break;
                            }
                        }
                        if (nearBg) {
                            Color c = crop.GetPixel(x, y);
                            int minChannel = Math.Min(c.R, Math.Min(c.G, c.B));
                            if (minChannel > 170) {
                                double factor = (minChannel - 170.0) / 85.0;
                                int alpha = (int)Math.Max(0, Math.Min(255, (1.0 - factor) * 255));
                                int r = (int)Math.Max(0, c.R - factor * 80);
                                int g = (int)Math.Max(0, c.G - factor * 80);
                                int b = (int)Math.Max(0, c.B - factor * 80);
                                crop.SetPixel(x, y, Color.FromArgb(alpha, r, g, b));
                            }
                        }
                    }
                }
            }

            crop.Save(outputPath, ImageFormat.Png);
        }
        Console.WriteLine("Saved mage unit: " + outputPath);
    }

    private static void SaveWhiteUnit(Bitmap src, Rectangle rect, string outputPath) {
        using (Bitmap crop = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb)) {
            int w = rect.Width, h = rect.Height;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    crop.SetPixel(x, y, src.GetPixel(rect.X + x, rect.Y + y));
                }
            }

            bool[,] isBg = new bool[w, h];
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    Color c = crop.GetPixel(x, y);
                    if (c.R >= 220 && c.G >= 220 && c.B >= 220) {
                        isBg[x, y] = true;
                    }
                }
            }

            bool[,] visited = new bool[w, h];
            Queue<Point> q = new Queue<Point>();
            for (int x = 0; x < w; x++) {
                TryEnqueue(q, visited, isBg, x, 0, w, h);
                TryEnqueue(q, visited, isBg, x, h - 1, w, h);
            }
            for (int y = 0; y < h; y++) {
                TryEnqueue(q, visited, isBg, 0, y, w, h);
                TryEnqueue(q, visited, isBg, w - 1, y, w, h);
            }

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };
            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i], ny = p.Y + dy[i];
                    TryEnqueue(q, visited, isBg, nx, ny, w, h);
                }
            }

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (visited[x, y]) {
                        crop.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    } else {
                        bool nearBg = false;
                        for (int i = 0; i < 4; i++) {
                            int nx = x + dx[i], ny = y + dy[i];
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h && visited[nx, ny]) {
                                nearBg = true;
                                break;
                            }
                        }
                        if (nearBg) {
                            Color c = crop.GetPixel(x, y);
                            int minChannel = Math.Min(c.R, Math.Min(c.G, c.B));
                            if (minChannel > 170) {
                                double factor = (minChannel - 170.0) / 85.0;
                                int alpha = (int)Math.Max(0, Math.Min(255, (1.0 - factor) * 255));
                                int r = (int)Math.Max(0, c.R - factor * 80);
                                int g = (int)Math.Max(0, c.G - factor * 80);
                                int b = (int)Math.Max(0, c.B - factor * 80);
                                crop.SetPixel(x, y, Color.FromArgb(alpha, r, g, b));
                            }
                        }
                    }
                }
            }

            crop.Save(outputPath, ImageFormat.Png);
        }
        Console.WriteLine("Saved white unit: " + outputPath);
    }

    private static void SaveCheckerUnit(Bitmap src, Rectangle rect, string outputPath, bool isViking) {
        using (Bitmap crop = new Bitmap(rect.Width, rect.Height, PixelFormat.Format32bppArgb)) {
            int w = rect.Width, h = rect.Height;
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    crop.SetPixel(x, y, src.GetPixel(rect.X + x, rect.Y + y));
                }
            }

            bool[,] isBg = new bool[w, h];
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    Color c = crop.GetPixel(x, y);
                    int maxDiff = Math.Max(Math.Abs(c.R - c.G), Math.Max(Math.Abs(c.R - c.B), Math.Abs(c.G - c.B)));
                    if (maxDiff <= 15 && c.R >= 165) {
                        isBg[x, y] = true;
                    }
                    // For viking: eliminate 'Viking Boss' text area (x >= 110, y >= 418)
                    if (isViking && x >= 110 && y >= 418) {
                        isBg[x, y] = true;
                    }
                }
            }

            bool[,] visited = new bool[w, h];
            Queue<Point> q = new Queue<Point>();
            for (int x = 0; x < w; x++) {
                TryEnqueue(q, visited, isBg, x, 0, w, h);
                TryEnqueue(q, visited, isBg, x, h - 1, w, h);
            }
            for (int y = 0; y < h; y++) {
                TryEnqueue(q, visited, isBg, 0, y, w, h);
                TryEnqueue(q, visited, isBg, w - 1, y, w, h);
            }

            int[] dx = { 1, -1, 0, 0 };
            int[] dy = { 0, 0, 1, -1 };
            while (q.Count > 0) {
                Point p = q.Dequeue();
                for (int i = 0; i < 4; i++) {
                    int nx = p.X + dx[i], ny = p.Y + dy[i];
                    TryEnqueue(q, visited, isBg, nx, ny, w, h);
                }
            }

            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    if (visited[x, y]) {
                        crop.SetPixel(x, y, Color.FromArgb(0, 0, 0, 0));
                    } else {
                        bool nearBg = false;
                        for (int i = 0; i < 4; i++) {
                            int nx = x + dx[i], ny = y + dy[i];
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h && visited[nx, ny]) {
                                nearBg = true;
                                break;
                            }
                        }
                        if (nearBg) {
                            Color c = crop.GetPixel(x, y);
                            int maxDiff = Math.Max(Math.Abs(c.R - c.G), Math.Max(Math.Abs(c.R - c.B), Math.Abs(c.G - c.B)));
                            if (maxDiff <= 15 && c.R >= 160) {
                                double factor = (c.R - 160.0) / 95.0;
                                int alpha = (int)Math.Max(0, Math.Min(255, (1.0 - factor) * 255));
                                int r = (int)Math.Max(0, c.R - factor * 80);
                                int g = (int)Math.Max(0, c.G - factor * 80);
                                int b = (int)Math.Max(0, c.B - factor * 80);
                                crop.SetPixel(x, y, Color.FromArgb(alpha, r, g, b));
                            }
                        }
                    }
                }
            }

            crop.Save(outputPath, ImageFormat.Png);
        }
        Console.WriteLine("Saved checker unit: " + outputPath);
    }

    private static void TryEnqueue(Queue<Point> q, bool[,] visited, bool[,] isBg, int x, int y, int w, int h) {
        if (x >= 0 && x < w && y >= 0 && y < h) {
            if (isBg[x, y] && !visited[x, y]) {
                visited[x, y] = true;
                q.Enqueue(new Point(x, y));
            }
        }
    }
}
"@

Add-Type -TypeDefinition $source -ReferencedAssemblies "System.Drawing"
[AssetExtractor]::ExtractAll("D:\VS code(game)\Gemini_Generated_Image_26lei326lei326le.png", "D:\VS code(game)")
