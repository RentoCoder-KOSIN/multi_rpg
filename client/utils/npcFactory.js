import NPC from '../entities/NPC.js';

export function createNPCsFromMap(scene, map, layerName = 'NPCs') {
    const npcs = [];
    const npcLayer = map.getObjectLayer(layerName);
    if (!npcLayer) return npcs;

    npcLayer.objects.forEach(obj => {
        const texture = obj.properties?.find(p => p.name === 'texture')?.value || 'npc';
        const name = obj.properties?.find(p => p.name === 'name')?.value || 'NPC';
        const questId = obj.properties?.find(p => p.name === 'questId')?.value ?? null;
        const jobQuest = obj.properties?.find(p => p.name === 'jobQuest')?.value ?? null;
        const jobsProp = obj.properties?.find(p => p.name === 'jobs');
        const jobs = jobsProp && (jobsProp.value === true || jobsProp.value === 'true');

        let is_Complited = obj.properties?.find(p => p.name === 'is_Complited')?.value ?? false;

        let dialogue = obj.properties?.find(p => p.name === 'dialogue')?.value || [];
        try { dialogue = typeof dialogue === 'string' ? JSON.parse(dialogue) : dialogue; }
        catch { dialogue = [dialogue]; }

        const npc = new NPC(scene, obj.x, obj.y, texture);
        npc.name = name;
        npc.dialogue = dialogue;
        npc.questId = questId;
        npc.jobQuest = jobQuest;
        npc.jobs = jobs;
        npc.is_Complited = is_Complited;
        // bossNPCプロパティを追加（BattleScene用）
        // Tiledではbooleanが文字列として保存される場合があるため、両方に対応
        const bossNPCProp = obj.properties?.find(p => p.name === 'bossNPC');
        npc.bossNPC = bossNPCProp && (
            bossNPCProp.value === true ||
            bossNPCProp.value === 'true' ||
            String(bossNPCProp.value).toLowerCase() === 'true'
        );
        if (npc.bossNPC) {
            console.log('[npcFactory] Boss NPC found:', npc.name, 'value:', bossNPCProp.value);
        }
        npcs.push(npc);
    });

    return npcs;
}
