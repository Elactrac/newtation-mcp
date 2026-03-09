## 2025-03-09 - HTML Word Count Optimization
**Learning:** Parsing large HTML bodies and using consecutive global regex replace operations + regex splitting leads to heavy GC overhead and poor performance.
**Action:** Combine multiple simple tag removals (`<script>` and `<style>`) into one regex (`/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi`) to traverse the string once. Replaced final string `.split(/\s+/)` with an optimized loop counting spaces after whitespace normalization, improving `countWords` latency by ~50% in complex DOM trees.
