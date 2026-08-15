// ==UserScript==
// @name         EduCenter Zalo Auto Sender
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Tự động điền và gửi tin nhắn học phí trên Zalo Web
// @author       EduCenter Team
// @match        https://chat.zalo.me/*
// @match        https://zalo.me/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=zalo.me
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  console.log('[EduCenter Zalo Auto] Script active on Zalo Web.');

  function triggerNativeInput(element, value) {
    element.focus();
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
  }

  function autoSendFromUrlParams() {
    const hash = window.location.hash || '';
    if (!hash.includes('educenter_auto=1')) return;

    const urlParams = new URLSearchParams(hash.replace('#', '?'));
    let phone = urlParams.get('phone') || '';
    const text = urlParams.get('text') || '';

    if (!phone || !text) return;

    // Convert 84xxx to 0xxx for Zalo search compatibility
    if (phone.startsWith('84')) {
      phone = '0' + phone.substring(2);
    }

    console.log(`[EduCenter Zalo Auto] Searching phone number: ${phone}`);

    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (attempts > 30) {
        clearInterval(checkInterval);
        console.warn('[EduCenter Zalo Auto] Search input timeout.');
        return;
      }

      const searchInput = document.querySelector('#contact-search-input') || 
                          document.querySelector('input[placeholder*="Tìm kiếm"]') ||
                          document.querySelector('.search-input') ||
                          document.querySelector('input[type="text"]');

      if (searchInput) {
        clearInterval(checkInterval);

        // Perform search input
        triggerNativeInput(searchInput, phone);

        // Wait for search dropdown / results to render
        setTimeout(() => {
          const searchResult = document.querySelector('.conv-item') || 
                               document.querySelector('.search-item') ||
                               document.querySelector('.cell-item') ||
                               document.querySelector('.global-search-item') ||
                               document.querySelector('[data-id]');
          if (searchResult) {
            console.log('[EduCenter Zalo Auto] Found contact result, clicking...');
            searchResult.click();

            // Wait for chat box to open
            setTimeout(() => {
              const chatInput = document.querySelector('#input_chat_topic') || 
                                document.querySelector('div[contenteditable="true"]') ||
                                document.querySelector('.rich-input');
              if (chatInput) {
                chatInput.focus();
                document.execCommand('insertText', false, decodeURIComponent(text));
                chatInput.dispatchEvent(new Event('input', { bubbles: true }));

                setTimeout(() => {
                  const sendBtn = document.querySelector('.btn-send') || 
                                  document.querySelector('[title="Gửi"]') ||
                                  document.querySelector('.send-btn');
                  if (sendBtn) {
                    sendBtn.click();
                  } else {
                    chatInput.dispatchEvent(new KeyboardEvent('keydown', {
                      key: 'Enter',
                      code: 'Enter',
                      keyCode: 13,
                      which: 13,
                      bubbles: true
                    }));
                  }
                  console.log('[EduCenter Zalo Auto] Message sent successfully!');
                }, 600);
              }
            }, 1000);
          } else {
            console.warn('[EduCenter Zalo Auto] Contact not found in Zalo search for: ' + phone);
          }
        }, 1500);
      }
    }, 500);
  }

  window.addEventListener('load', autoSendFromUrlParams);
  window.addEventListener('hashchange', autoSendFromUrlParams);
})();
