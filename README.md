<div align="center">
  <img src="icons/logo.png" alt="Rudra Logo" width="128" height="128">
  <h1>Rudra</h1>
  <p><strong>A lightning-fast, keyboard-centric launcher for GNOME Shell</strong></p>
  <p>Developed by <strong>Narkagni</strong></p>
</div>

<hr>

<h2>Overview</h2>
<p>
  Rudra is a modern launcher designed to replace or augment the default GNOME overview. 
  Inspired by tools like Alfred and Raycast, it provides instant access to applications, files, 
  web searches, and system commands—all through a minimal, highly customizable interface.
</p>

<h2>Gallery</h2>
<p>
  <strong>The Launcher & Preferences:</strong> Minimalist design with deep customization.
</p>
<div align="center">
  <img src="media/launcher.png" alt="Rudra Launcher Interface" width="100%" style="border-radius: 8px; border: 1px solid #333; margin-bottom: 10px;">
  <img src="media/settings.png" alt="Preferences Window" width="100%" style="border-radius: 8px; border: 1px solid #333;">
</div>

<hr>

<h2>Key Features</h2>

<details>
  <summary><strong>Universal Search</strong></summary>
  <p>
    Rudra intelligently routes your queries based on prefixes, keeping your workflow uninterrupted.
  </p>
  <ul>
    <li><strong>Applications:</strong> Type normally to find and launch installed apps.</li>
    <li><strong>File Hunt (<code>.</code>):</strong> Start with a dot to instantly search for files in your home directory.</li>
    <li><strong>Google Search (<code>g </code>):</strong> Type 'g' followed by a space to search Google in your default browser.</li>
    <li><strong>YouTube Search (<code>yt </code>):</strong> Type 'yt' followed by a space to search YouTube directly.</li>
    <li><strong>Command Runner (<code>&gt;</code>):</strong> Start with '>' to execute shell commands directly.</li>
  </ul>
</details>

<details>
  <summary><strong>Smart Autocomplete</strong></summary>
  <p>
    The launcher predicts what you are typing and offers inline suggestions. 
    Simply press <strong>Tab</strong> or <strong>Right Arrow</strong> to complete the suggestion.
  </p>
</details>

<details>
  <summary><strong>Deep Customization</strong></summary>
  <p>
    Make Rudra look exactly how you want via the modern LibAdwaita preferences window.
  </p>
  <ul>
    <li><strong>Typography:</strong> Customize font family and size.</li>
    <li><strong>Colors:</strong> Set custom background, text, highlight, and selection colors.</li>
    <li><strong>Opacity:</strong> Adjust transparency for the background and selection bars.</li>
    <li><strong>Layout:</strong> Configure margins, width, corner radius, and result spacing.</li>
  </ul>
</details>

<hr>

<h2>Installation</h2>

<h3>Requirements</h3>
<ul>
  <li>GNOME Shell 45 - 49</li>
  <li><code>libglib2.0-bin</code> (Required for schema compilation)</li>
</ul>

<h3>Install from Source</h3>

<p><strong>1. Clone the repository</strong></p>
<pre>
git clone https://github.com/NarkAgni/rudra.git
cd rudra
</pre>

<p><strong>2. Install using Make</strong></p>
<pre>
make install
</pre>

<p><strong>3. Restart GNOME Shell</strong></p>
<p>For X11: Press <code>Alt+F2</code>, type <code>r</code>, and hit Enter.<br>
For Wayland: Log out and log back in.</p>

<p><strong>4. Enable the extension</strong></p>
<pre>
gnome-extensions enable rudra@narkagni
</pre>

<hr>

<h2>Usage</h2>

<ul>
  <li><strong>Toggle Launcher:</strong> <code>Ctrl + Shift + Space</code> (Default, customizable in settings)</li>
  <li><strong>Navigate Results:</strong> <code>Up / Down</code> Arrows</li>
  <li><strong>Select/Run:</strong> <code>Enter</code></li>
  <li><strong>Autocomplete:</strong> <code>Tab</code> or <code>Right Arrow</code></li>
  <li><strong>Close:</strong> <code>Esc</code></li>
</ul>

<hr>

<h2>Support Development</h2>
<p>
  This extension is free and open-source. If Rudra boosts your productivity, consider supporting the development.
</p>

<div align="center">
  <a href="https://github.com/sponsors/NarkAgni">
    <img src="https://img.shields.io/badge/Sponsor_on_GitHub-EA4AAA?style=for-the-badge&logo=github-sponsors" height="40">
  </a>
  &nbsp;&nbsp;
  <a href="https://buymeacoffee.com/narkagni">
    <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" height="40">
  </a>
</div>

<br>

<details>
  <summary><strong>Crypto Addresses</strong></summary>
  <br>
  <p><strong>Bitcoin (BTC):</strong></p>
  <pre>1GSHkxfhYjk1Qe4AQSHg3aRN2jg2GQWAcV</pre>

  <p><strong>Ethereum (ETH):</strong></p>
  <pre>0xf43c3f83e53495ea06676c0d9d4fc87ce627ffa3</pre>

  <p><strong>Tether (USDT - TRC20):</strong></p>
  <pre>THnqG9nchLgaf1LzGK3CqdmNpRxw59hs82</pre>
</details>

<hr>

<p align="center">
  License: GPL-3.0
</p>
