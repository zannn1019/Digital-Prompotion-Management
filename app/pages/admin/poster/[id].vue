<script setup lang="ts">
const route = useRoute()
await navigateTo(`/admin/posters/${encodeURIComponent(String(route.params.id))}`, { redirectCode: 301 })
</script>
