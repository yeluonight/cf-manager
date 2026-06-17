<template>
  <div>
    <n-h2>DNS 管理</n-h2>
    <n-space align="center" style="margin-bottom: 12px">
      <n-select v-model:value="dnsAccountFilter" :options="dnsAccountOptions"
        placeholder="全部账号" style="width: 200px" size="small" clearable />
      <n-input v-model:value="dnsSearch" placeholder="搜索域名" size="small"
        style="width: 200px" clearable />
    </n-space>
    <n-grid :cols="24" :x-gap="12" :y-gap="12" responsive="screen" item-responsive>
      <!-- 左侧域名列表 -->
      <n-gi span="24 m:6">
        <n-card title="域名列表" size="small">
          <n-list hoverable clickable>
            <n-list-item
              v-for="d in filteredDomains"
              :key="d.name || d"
              @click="selectDomain(typeof d === 'string' ? d : d.name)"
              :style="{ background: dnsStore.currentDomain === (typeof d === 'string' ? d : d.name) ? 'rgba(24,160,88,0.1)' : '' }"
            >
              <div>{{ typeof d === 'string' ? d : d.name }}</div>
              <n-text v-if="d.accountName" depth="3" style="font-size: 11px">{{ d.accountName }}</n-text>
            </n-list-item>
          </n-list>
          <n-empty v-if="!filteredDomains.length" description="暂无域名" style="margin-top: 16px" />
        </n-card>
      </n-gi>

      <!-- 右侧记录表格 -->
      <n-gi span="24 m:18">
        <n-card :title="dnsStore.currentDomain ? `${dnsStore.currentDomain} - DNS 记录` : 'DNS 记录'" size="small">
          <template #header-extra>
            <n-button size="small" type="primary" :disabled="!dnsStore.currentDomain" @click="showAddModal = true">添加记录</n-button>
          </template>
          <n-data-table
            :columns="recordColumns"
            :data="dnsStore.records"
            :loading="dnsStore.loading"
            size="small"
            :bordered="false"
            :scroll-x="680"
          />
        </n-card>
      </n-gi>
    </n-grid>

    <!-- 添加记录 Modal -->
    <n-modal v-model:show="showAddModal" preset="dialog" title="添加 DNS 记录" style="width: 520px; max-width: 95vw">
      <n-form :model="newRecord" label-placement="left" label-width="80">
        <n-form-item label="类型">
          <n-select v-model:value="newRecord.type" :options="typeOptions" />
        </n-form-item>
        <n-form-item label="名称">
          <n-input v-model:value="newRecord.name" placeholder="例: www 或 @ 或 *" />
        </n-form-item>
        <n-form-item label="内容">
          <n-input v-model:value="newRecord.content" placeholder="IP 地址或域名" />
        </n-form-item>
        <n-form-item label="TTL">
          <n-input-number v-model:value="newRecord.ttl" :min="60" :max="86400" />
        </n-form-item>
        <n-form-item label="代理">
          <n-switch v-model:value="newRecord.proxied" />
        </n-form-item>
      </n-form>
      <template #action>
        <n-button @click="showAddModal = false">取消</n-button>
        <n-button type="primary" :loading="adding" @click="handleAddRecord">添加</n-button>
      </template>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue';
import { NButton, NSwitch, NTag, NText, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import { useDnsStore } from '../stores/dnsStore';
import { useAccountStore } from '../stores/accountStore';
import { dnsApi } from '../api/dns';

const dnsStore = useDnsStore();
const accountStore = useAccountStore();
const message = useMessage();

const dnsAccountFilter = ref<number | null>(null);
const dnsSearch = ref('');

const dnsAccountOptions = computed(() =>
  accountStore.accounts
    .filter((a: any) => a.is_active && (a.enabled_features || '').includes('dns'))
    .map((a: any) => ({ label: a.name, value: a.id }))
);

const filteredDomains = computed(() => {
  let list = dnsStore.domains;
  if (dnsAccountFilter.value) list = list.filter((d: any) => d.cfAccountId === dnsAccountFilter.value);
  if (dnsSearch.value) list = list.filter((d: any) => (d.name || '').toLowerCase().includes(dnsSearch.value.toLowerCase()));
  return list;
});

const showAddModal = ref(false);
const adding = ref(false);

const typeOptions = ['A', 'AAAA', 'CNAME', 'MX', 'TXT', 'SRV', 'NS', 'PTR'].map(t => ({ label: t, value: t }));

const newRecord = ref({ type: 'A', name: '', content: '', ttl: 300, proxied: true });

function selectDomain(domain: string) {
  dnsStore.fetchRecords(domain);
}

async function handleAddRecord() {
  if (!dnsStore.currentDomain) return;
  adding.value = true;
  try {
    await dnsApi.createRecord(dnsStore.currentDomain, newRecord.value);
    message.success('记录已添加');
    showAddModal.value = false;
    newRecord.value = { type: 'A', name: '', content: '', ttl: 300, proxied: true };
    dnsStore.fetchRecords(dnsStore.currentDomain);
  } finally {
    adding.value = false;
  }
}

async function handleDeleteRecord(row: any) {
  if (!dnsStore.currentDomain) return;
  await dnsApi.deleteRecord(dnsStore.currentDomain, row.id);
  message.success('记录已删除');
  dnsStore.fetchRecords(dnsStore.currentDomain);
}

async function handleProxyToggle(row: any, proxied: boolean) {
  if (!dnsStore.currentDomain) return;
  await dnsApi.updateProxy(dnsStore.currentDomain, row.id, proxied);
  row.proxied = proxied;
  message.success('代理状态已更新');
}

const recordColumns: DataTableColumns<any> = [
  { title: '类型', key: 'type', width: 80, render: (row) => h(NTag, { size: 'small', type: 'info' }, { default: () => row.type }) },
  { title: '名称', key: 'name', width: 180, ellipsis: { tooltip: true } },
  { title: '内容', key: 'content', minWidth: 180, ellipsis: { tooltip: true } },
  { title: 'TTL', key: 'ttl', width: 80, render: (row) => row.ttl === 1 ? '自动' : row.ttl },
  {
    title: '代理', key: 'proxied', width: 80,
    render: (row) => h(NSwitch, { value: row.proxied, onUpdateValue: (v: boolean) => handleProxyToggle(row, v), size: 'small' }),
  },
  {
    title: '操作', key: 'actions', width: 80,
    render: (row) => h(NButton, { size: 'small', type: 'error', onClick: () => handleDeleteRecord(row) }, { default: () => '删除' }),
  },
];

onMounted(() => {
  dnsStore.fetchDomains();
  accountStore.fetchAccounts();
});
</script>
