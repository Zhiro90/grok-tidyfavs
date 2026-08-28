> ⚠️ **ARCHIVED PROJECT (August 2026)**
> 
> Grok has officially removed the native folders/tags feature from their UI, so now all creations into a single unified view. Since this script was based on this now removed feature, **Grok TidyFavs has lost its purpose and is now indefinitely obsolete.**
> 
> I have unlisted the script from GreasyFork to prevent broken installs and archived this repository. The code remains here for reference (if you are dealing with React Virtual List Overloads, the *Micro-Shrink* engine inside `grok-tidyfavs.user.js` might still be a useful read).
> 
> Massive thanks to everyone who reported bugs, tested the fixes, and helped tame the infinite scroller. It was a fun ride while it lasted.

# 🧹 Grok TidyFavs

[![Install Script](https://img.shields.io/badge/Install-UserScript-232323?style=for-the-badge&logo=javascript)](https://raw.githubusercontent.com/Zhiro90/grok-tidyfavs/main/grok-tidyfavs.user.js) [![Downloads](https://img.shields.io/greasyfork/dt/568274?style=for-the-badge&color=2b5b84)](https://greasyfork.org/scripts/568274) [![GreasyFork](https://img.shields.io/badge/GreasyFork-Page-c1282d?style=for-the-badge)](https://greasyfork.org/scripts/568274) [![License](https://img.shields.io/badge/License-MIT-3a7a40?style=for-the-badge)](https://github.com/Zhiro90/grok-tidyfavs/blob/main/LICENSE)

A lightweight UserScript for Grok/Imagine Favorites section that automatically hides images in your "All" feed once they have been assigned to a custom folder, keeping your workspace clean and organized.

https://github.com/user-attachments/assets/bdbd1adc-d0f0-41ed-9d70-1cfe752b1559

## 📢 What's New (v1.3.2)

* **Modal Silence:** Fixed a bug where "ghost" thumbnails would flash in the background while viewing a creation in the large carousel/modal. The script now correctly pauses all background resizing when an image is actively opened.
* **Spacer method:** Replaced the previous 1x1 pixel squish with a 10px, 100% transparent spacer. This gives Grok's virtual list enough physical volume to register the screen as "full," completely eliminating infinite-loop panics for users with massive (1k+) collections.
* **UI Declutter:** Because the new Micro-Shrink engine is now 100% stable and no longer causes React to desync, the manual "Refresh" button was completely removed for a cleaner interface.
  
## ✨ Features

* **Smart Filtering:** Automatically hides images in your "All" view if they are already saved in a specific folder. Simply visit your custom folders; the script automatically learns and memorizes which images are organized without any manual input.
* **Floating UI:** A minimalist toggle button in the bottom right corner lets you instantly show or hide organized images.
* **Memory Management:** Includes a quick reset button with a toast notifications to wipe the script's memory and start fresh.

## 📥 Installation

1. Install a UserScript manager:
   * **Chrome/Edge:** [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/)
   * **Firefox:** [Violentmonkey](https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/) or [Tampermonkey](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
2. Click the **Install Script** button at the top of this page, or install it directly from [GreasyFork](https://greasyfork.org/scripts/568274). JS file also available in [releases](https://github.com/Zhiro90/tabgrabberr/releases/latest)

## 🛠️ Usage

1. Navigate to your [Grok.com](https://grok.com/) favorites or collection page.
2. Go to your custom folders first and scroll to the end of each one (to lazyload every image). The script will scan and memorize the images inside them.
3. Return to the **"All"** tab. Upon pressing the  **👁️ button**, the script will hide the images you just memorized and collapse the empty spaces.
4. Pressing it again will toggle the visibility of organized images back on.
5. The script only monitors additions, so if you remove a creation from a folder, click the **Reset (🗑️) button** to clear the local memory, otherwise it'll remain hidden everywhere.

## 🗺️ Roadmap

* **Scan entire folder:** Currently, folders need to be scrolled all the way down to lazy load all creations, working on a way to load them all without scrolling.
* **Thumbnail Restructuring:** Improve the grid re-rendering logic to be less jittery
  
***
*Made with 🤍 for the Grok community.*
