const COPY_FEEDBACK_DURATION = 2000;
const SCROLL_THRESHOLD = 80;
const SCROLL_STEP = 200;
const INPUT_MAX_HEIGHT = 200;
const STREAM_INIT_DELAY = 400;

const chatEl = document.getElementById('messages');
const chatContainer = document.getElementById('chat');
const loadingEl = document.getElementById('loading');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const dropdownToggle = document.querySelector('.dropdown-toggle');
const dropdownMenu = document.querySelector('.dropdown-menu');
