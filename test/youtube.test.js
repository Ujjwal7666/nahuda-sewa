import test from 'node:test';
import assert from 'node:assert/strict';
import {youtubeVideo} from '../src/config/youtube.js';
test('YouTube URLs resolve to fixed safe video IDs and reject unsafe or ambiguous URLs',()=> {
  for(const url of ['https://www.youtube.com/watch?v=abcdefghijk','https://youtu.be/abcdefghijk?t=30','https://m.youtube.com/shorts/abcdefghijk','https://www.youtube-nocookie.com/embed/abcdefghijk','https://youtube.com/live/abcdefghijk']) assert.deepEqual(youtubeVideo(url),{id:'abcdefghijk',watch:'https://www.youtube.com/watch?v=abcdefghijk',embed:'https://www.youtube-nocookie.com/embed/abcdefghijk'});
  for(const url of [null,[], 'javascript:alert(1)','http://youtube.com/watch?v=abcdefghijk','https://youtube.com.evil.test/watch?v=abcdefghijk','https://evil.test/embed/abcdefghijk','https://user:secret@youtube.com/watch?v=abcdefghijk','https://youtube.com:444/watch?v=abcdefghijk','https://youtube.com/watch?v=abcdefghijk&v=lmnopqrstuv','https://youtu.be/too-short','<iframe src="https://youtube.com"></iframe>']) assert.equal(youtubeVideo(url),null);
});
