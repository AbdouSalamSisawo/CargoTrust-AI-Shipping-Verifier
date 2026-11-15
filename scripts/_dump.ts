import { readAttachment } from '@/lib/dataset';
(async () => {
  for (const p of process.argv.slice(2)) {
    const r = await readAttachment('attachments/' + p);
    console.log('=====', p, r.size, '\n' + (r.text ?? '<<NULL>>').slice(0, 1600));
  }
})();
