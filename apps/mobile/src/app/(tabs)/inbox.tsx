import { useState, useCallback, useMemo } from 'react';
import {
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Screen, ScreenHeader, Card, CenterState } from '../../ui/primitives';
import { Icon } from '../../ui/Icon';
import { colors } from '../../theme/colors';
import {
  useInbox,
  useCreateInbox,
  useUpdateInbox,
  useDeleteInbox,
  type InboxItemDto,
} from '../../hooks/useInbox';

export default function InboxScreen() {
  const inbox = useInbox();
  const createInbox = useCreateInbox();
  const updateInbox = useUpdateInbox();
  const deleteInbox = useDeleteInbox();
  const [draft, setDraft] = useState('');

  const onRefresh = useCallback(() => inbox.refetch(), [inbox]);

  const pending = useMemo(
    () => (inbox.data ?? []).filter((i) => i.status === 'pending'),
    [inbox.data],
  );

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    createInbox.mutate({ text });
    setDraft('');
  };

  return (
    <Screen>
      <ScreenHeader
        title="Inbox"
        subtitle={pending.length ? `${pending.length} sin procesar` : 'Bandeja vacía'}
      />

      <View className="px-4 pb-2">
        <Card className="flex-row items-center gap-2 px-3 py-1">
          <Icon name="plus" size={18} color={colors.muted} />
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={add}
            returnKeyType="done"
            placeholder="Captura algo rápido…"
            placeholderTextColor={colors.muted}
            className="h-10 flex-1 text-sm text-kibo-text"
          />
          {draft.trim() ? (
            <TouchableOpacity onPress={add} hitSlop={8}>
              <Text className="text-sm font-semibold text-kibo-accent">Guardar</Text>
            </TouchableOpacity>
          ) : null}
        </Card>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={inbox.isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {inbox.isLoading ? (
          <CenterState loading title="Cargando inbox…" />
        ) : pending.length === 0 ? (
          <CenterState
            icon="inbox"
            title="Bandeja a cero"
            subtitle="Todo lo que captures aparecerá aquí para procesarlo luego."
          />
        ) : (
          pending.map((item) => (
            <InboxRow
              key={item.id}
              item={item}
              onProcess={() => updateInbox.mutate({ id: item.id, status: 'processed' })}
              onDelete={() => deleteInbox.mutate(item.id)}
            />
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function InboxRow({
  item,
  onProcess,
  onDelete,
}: {
  item: InboxItemDto;
  onProcess: () => void;
  onDelete: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <TouchableOpacity onPress={onProcess} hitSlop={8}>
        <Icon name="check-circle" size={22} color={colors.muted} />
      </TouchableOpacity>
      <Text className="flex-1 text-sm text-kibo-text" numberOfLines={3}>
        {item.text}
      </Text>
      <TouchableOpacity onPress={onDelete} hitSlop={8}>
        <Icon name="trash-2" size={16} color={colors.muted} />
      </TouchableOpacity>
    </Card>
  );
}
