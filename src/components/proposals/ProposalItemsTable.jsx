
import React, { useState, useEffect, useMemo } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, GripVertical } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const MemoizedRow = React.memo(({ item, index, handleItemChange, handleDeleteItem, provided }) => {
    return (
        <tr ref={provided.innerRef} {...provided.draggableProps} className="bg-white hover:bg-slate-50">
            <td className="p-2 w-10 text-center">
                <div {...provided.dragHandleProps} className="cursor-grab text-slate-400">
                    <GripVertical className="w-5 h-5" />
                </div>
            </td>
            <td className="p-2 w-24">
                <Select
                    value={item.type}
                    onValueChange={(value) => handleItemChange(index, 'type', value)}
                >
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="labor">Εργασία</SelectItem>
                        <SelectItem value="material">Υλικό</SelectItem>
                    </SelectContent>
                </Select>
            </td>
            <td className="p-2 min-w-64">
                <Input
                    placeholder="Περιγραφή εργασίας ή υλικού"
                    value={item.description || ''}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                />
            </td>
            <td className="p-2 w-24">
                <Input
                    type="number"
                    placeholder="Ποσ."
                    value={item.quantity || ''}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                />
            </td>
            <td className="p-2 w-24">
                 <Input
                    placeholder="Μονάδα"
                    value={item.unit || ''}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                />
            </td>
            <td className="p-2 w-28">
                <Input
                    type="number"
                    placeholder="Τιμή"
                    value={item.unit_price || ''}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                />
            </td>
             <td className="p-2 w-24">
                <Input
                    type="number"
                    value={item.vat_rate || ''}
                    onChange={(e) => handleItemChange(index, 'vat_rate', parseInt(e.target.value))}
                />
            </td>
            <td className="p-2 w-28 font-medium text-right">
                €{((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
            </td>
            <td className="p-2 w-16 text-center">
                <Checkbox
                    checked={item.is_optional}
                    onCheckedChange={(checked) => handleItemChange(index, 'is_optional', checked)}
                />
            </td>
            <td className="p-2 w-16 text-center">
                <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(index)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
            </td>
        </tr>
    );
});

// Mobile card view for items
const MobileItemCard = ({ item, index, handleItemChange, handleDeleteItem }) => {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
                <Select
                    value={item.type}
                    onValueChange={(value) => handleItemChange(index, 'type', value)}
                >
                    <SelectTrigger className="w-24">
                        <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="labor">Εργασία</SelectItem>
                        <SelectItem value="material">Υλικό</SelectItem>
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Checkbox
                        checked={item.is_optional}
                        onCheckedChange={(checked) => handleItemChange(index, 'is_optional', checked)}
                    />
                    <span className="text-xs text-slate-500">Optional</span>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteItem(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                </div>
            </div>
            
            <Input
                placeholder="Περιγραφή εργασίας ή υλικού"
                value={item.description || ''}
                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                className="text-sm w-full"
            />
            
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    placeholder="Ποσότητα"
                    value={item.quantity || ''}
                    onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))}
                    className="text-sm w-full"
                />
                <Input
                    placeholder="Μονάδα"
                    value={item.unit || ''}
                    onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                    className="text-sm w-full"
                />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <Input
                    type="number"
                    placeholder="Τιμή μονάδας"
                    value={item.unit_price || ''}
                    onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value))}
                    className="text-sm w-full"
                />
                <Input
                    type="number"
                    placeholder="ΦΠΑ %"
                    value={item.vat_rate || ''}
                    onChange={(e) => handleItemChange(index, 'vat_rate', parseInt(e.target.value))}
                    className="text-sm w-full"
                />
            </div>
            
            <div className="text-right">
                <span className="text-lg font-bold text-slate-800">
                    €{((item.quantity || 0) * (item.unit_price || 0)).toFixed(2)}
                </span>
            </div>
        </div>
    );
};

export default function ProposalItemsTable({ items, setItems }) {
    const handleAddItem = () => {
        setItems([
            ...items,
            { id: `new-${Date.now()}`, type: 'labor', description: '', quantity: 1, unit: 'τεμ.', unit_price: 0, vat_rate: 24, is_optional: false }
        ]);
    };

    const handleDeleteItem = (index) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleOnDragEnd = (result) => {
        if (!result.destination) return;
        const reorderedItems = Array.from(items);
        const [reorderedItem] = reorderedItems.splice(result.source.index, 1);
        reorderedItems.splice(result.destination.index, 0, reorderedItem);
        setItems(reorderedItems);
    };

    const totals = useMemo(() => {
        const result = {
            subtotal: 0,
            vat_amount: 0,
            total: 0,
            optional_total: 0
        };
        items.forEach(item => {
            const lineTotal = (item.quantity || 0) * (item.unit_price || 0);
            if (item.is_optional) {
                result.optional_total += lineTotal * (1 + (item.vat_rate || 0) / 100);
            } else {
                result.subtotal += lineTotal;
                result.vat_amount += lineTotal * (item.vat_rate || 0) / 100;
            }
        });
        result.total = result.subtotal + result.vat_amount;
        return result;
    }, [items]);
    
    return (
        <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                    <thead>
                        <tr className="border-b bg-slate-50">
                            <th className="p-2 w-10"></th>
                            <th className="p-2 text-left font-semibold text-slate-600">Τύπος</th>
                            <th className="p-2 text-left font-semibold text-slate-600">Περιγραφή</th>
                            <th className="p-2 text-left font-semibold text-slate-600">Ποσ.</th>
                            <th className="p-2 text-left font-semibold text-slate-600">Μον.</th>
                            <th className="p-2 text-left font-semibold text-slate-600">Τιμή Μον. (€)</th>
                            <th className="p-2 text-left font-semibold text-slate-600">ΦΠΑ (%)</th>
                            <th className="p-2 text-right font-semibold text-slate-600">Σύνολο Γραμμής</th>
                            <th className="p-2 text-center font-semibold text-slate-600">Optional</th>
                            <th className="p-2 w-16"></th>
                        </tr>
                    </thead>
                    <DragDropContext onDragEnd={handleOnDragEnd}>
                        <Droppable droppableId="items">
                            {(provided) => (
                                <tbody {...provided.droppableProps} ref={provided.innerRef}>
                                    {items.map((item, index) => (
                                        <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                            {(provided) => (
                                                <MemoizedRow
                                                    item={item}
                                                    index={index}
                                                    handleItemChange={handleItemChange}
                                                    handleDeleteItem={handleDeleteItem}
                                                    provided={provided}
                                                />
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </tbody>
                            )}
                        </Droppable>
                    </DragDropContext>
                </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
                {items.map((item, index) => (
                    <MobileItemCard
                        key={item.id}
                        item={item}
                        index={index}
                        handleItemChange={handleItemChange}
                        handleDeleteItem={handleDeleteItem}
                    />
                ))}
            </div>

            <Button onClick={handleAddItem} variant="outline" className="w-full md:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                Προσθήκη Γραμμής
            </Button>
            
            <div className="flex justify-end mt-6">
                <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between text-sm md:text-base">
                        <span className="text-slate-600">Καθαρό Σύνολο:</span>
                        <span className="font-medium text-slate-800">€{totals.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                        <span className="text-slate-600">ΦΠΑ:</span>
                        <span className="font-medium text-slate-800">€{totals.vat_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg md:text-xl font-bold border-t pt-2 mt-2">
                        <span className="text-slate-800">Γενικό Σύνολο:</span>
                        <span className="gradient-text">€{totals.total.toFixed(2)}</span>
                    </div>
                    {totals.optional_total > 0 && (
                         <div className="flex justify-between text-xs md:text-sm pt-2 border-t border-dashed">
                            <span className="text-slate-500">Προαιρετικά (με ΦΠΑ):</span>
                            <span className="font-medium text-slate-600">€{totals.optional_total.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
