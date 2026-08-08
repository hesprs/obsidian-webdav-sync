export type SmartMergeTranslations = {
	conflictOursMarkers: string;
	conflictOursMarkersDescription: string;
	conflictTheirsMarkers: string;
	conflictTheirsMarkersDescription: string;
	deletionMarkers: string;
	deletionMarkersDescription: string;
	smartMerge: string;
	start: string;
	end: string;
};

export const en: SmartMergeTranslations = {
	conflictOursMarkers: '"Ours" conflict markers',
	conflictOursMarkersDescription:
		'Set the markers before and after the region in a merge conflict that shows local changes.',
	conflictTheirsMarkers: '"Theirs" conflict markers',
	conflictTheirsMarkersDescription:
		'Set the markers before and after the region in a merge conflict that shows remote changes.',
	deletionMarkers: 'Deletion conflict markers',
	deletionMarkersDescription:
		'Set the markers before and after the region that is deleted by one side, but modified by the other side.',
	end: 'End',
	smartMerge: 'Smart merge',
	start: 'Start',
};

export const zh: SmartMergeTranslations = {
	conflictOursMarkers: '“我方（本地）”冲突标记',
	conflictOursMarkersDescription: '设置在合并冲突中显示本地更改区域前后的标记。',
	conflictTheirsMarkers: '“他方（远程）”冲突标记',
	conflictTheirsMarkersDescription: '设置在合并冲突中显示远程更改区域前后的标记。',
	deletionMarkers: '删除冲突标记',
	deletionMarkersDescription:
		'设置在一侧删除了该区域，而另一侧修改了该区域时的冲突标记前缀与后缀。',
	end: '结束',
	smartMerge: '智能合并',
	start: '开始',
};

export const ru: SmartMergeTranslations = {
	conflictOursMarkers: 'Маркеры конфликта «Наши»',
	conflictOursMarkersDescription:
		'Укажите маркеры до и после области в конфликте слияния, которая содержит локальные изменения.',
	conflictTheirsMarkers: 'Маркеры конфликта «Чужие»',
	conflictTheirsMarkersDescription:
		'Укажите маркеры до и после области в конфликте слияния, которая содержит удалённые изменения.',
	deletionMarkers: 'Маркеры конфликта удаления',
	deletionMarkersDescription:
		'Укажите маркеры до и после области, которая была удалена с одной стороны, но изменена с другой.',
	end: 'Конец',
	smartMerge: 'Умное слияние',
	start: 'Начало',
};

export const zhTW: SmartMergeTranslations = {
	conflictOursMarkers: '「我方」衝突標記',
	conflictOursMarkersDescription: '設定合併衝突中代表本地變更區域的前後標記。',
	conflictTheirsMarkers: '「對方」衝突標記',
	conflictTheirsMarkersDescription: '設定合併衝突中代表遠端變更區域的前後標記。',
	deletionMarkers: '刪除衝突標記',
	deletionMarkersDescription: '設定被一方刪除但被另一方修改的區域前後標記。',
	end: '結束',
	smartMerge: '智慧合併',
	start: '開始',
};
