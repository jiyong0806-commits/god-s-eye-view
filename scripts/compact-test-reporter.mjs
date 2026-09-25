export default async function* report(events) {
  for await (const event of events) {
    if (event.type === 'test:fail') {
      const { name, file, line, details } = event.data;
      yield JSON.stringify({ result: 'fail', name, file, line, message: String(details?.error?.cause?.message || details?.error?.message || '').slice(0, 1200) }) + '\n';
    }
    if (event.type === 'test:summary') yield JSON.stringify({ result: 'summary', ...event.data }) + '\n';
  }
}
