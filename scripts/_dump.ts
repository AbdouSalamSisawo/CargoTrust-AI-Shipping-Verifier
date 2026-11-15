import { readAttachment } from '@/lib/dataset';
(async () => {
  for (const p of process.argv.slice(2)) {
    const r = await readAttachment('attachments/' + p);
    console.log('=====', p, r.method, '\n' + (r.text ?? '<<NULL ' + r.error + '>>').slice(0, 900));
  }
})();
