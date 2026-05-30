import React, { useState } from "react";
import { ClerkProvider } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Scissors, AlertTriangle, Eye, FileDown } from "lucide-react";
import { motion } from "framer-motion";


export default function CutMonitor() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    tree_id: "",
    location: "",
    species: "",
    reason: "disease_control",
    cutting_date: new Date().toISOString().split('T')[0],
    additional_details: ""
  });

  const { data: cuttingReports = [] } = useQuery({
    queryKey: ['cuttingReports'],
    queryFn: () => ClerkProvider.entities.TreeCuttingReport.list("-created_date"),
    initialData: [],
  });

  const reportMutation = useMutation({
    mutationFn: (data) => ClerkProvider.entities.TreeCuttingReport.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cuttingReports'] });
      setFormData({
        tree_id: "",
        location: "",
        species: "",
        reason: "disease_control",
        cutting_date: new Date().toISOString().split('T')[0],
        additional_details: ""
      });
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    reportMutation.mutate(formData);
  };

  const exportCSV = () => {
    const headers = ["Tree ID", "Location", "Species", "Reason", "Date", "Status"];
    const rows = cuttingReports.map(report => [
      report.tree_id,
      report.location,
      report.species,
      report.reason.replace(/_/g, ' '),
      new Date(report.cutting_date).toLocaleDateString(),
      report.status
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tree-cutting-reports.csv';
    link.click();
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    verified: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800"
  };

  const reasonLabels = {
    disease_control: "Disease Control",
    safety_hazard: "Safety Hazard",
    construction: "Construction",
    natural_disaster: "Natural Disaster",
    maintenance: "Maintenance",
    other: "Other"
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
              <Scissors className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900">Tree Cutting & Monitoring</h1>
              <p className="text-gray-600">Report and verify tree cutting events for transparency</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Report Form */}
          <Card className="lg:col-span-1 shadow-2xl border-none">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b">
              <CardTitle className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
                Report Tree Cutting
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="tree_id">Tree ID *</Label>
                  <Input
                    id="tree_id"
                    value={formData.tree_id}
                    onChange={(e) => setFormData({ ...formData, tree_id: e.target.value })}
                    placeholder="e.g., T-1001"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="location">Location *</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Central Park, NY"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="species">Species *</Label>
                  <Input
                    id="species"
                    value={formData.species}
                    onChange={(e) => setFormData({ ...formData, species: e.target.value })}
                    placeholder="e.g., Oak, Maple, etc."
                    required
                  />
                </div>

                <div>
                  <Label>Reason for Cutting *</Label>
                  <Select value={formData.reason} onValueChange={(value) => setFormData({ ...formData, reason: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="disease_control">Disease Control</SelectItem>
                      <SelectItem value="safety_hazard">Safety Hazard</SelectItem>
                      <SelectItem value="construction">Construction</SelectItem>
                      <SelectItem value="natural_disaster">Natural Disaster</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="cutting_date">Date *</Label>
                  <Input
                    id="cutting_date"
                    type="date"
                    value={formData.cutting_date}
                    onChange={(e) => setFormData({ ...formData, cutting_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="additional_details">Additional Details</Label>
                  <Textarea
                    id="additional_details"
                    value={formData.additional_details}
                    onChange={(e) => setFormData({ ...formData, additional_details: e.target.value })}
                    placeholder="Describe the situation, provide context..."
                    className="h-24"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
                  disabled={reportMutation.isPending}
                >
                  {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Recent Cutting Events */}
          <Card className="lg:col-span-2 shadow-2xl border-none">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-slate-50 border-b">
              <div className="flex justify-between items-center">
                <CardTitle className="text-2xl">Recent Cutting Events</CardTitle>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead>Tree ID</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Species</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cuttingReports.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12">
                          <div className="text-gray-400">
                            <Scissors className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No cutting events reported</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      cuttingReports.map((report) => (
                        <TableRow key={report.id} className="hover:bg-gray-50">
                          <TableCell className="font-mono font-semibold">{report.tree_id}</TableCell>
                          <TableCell>{report.location}</TableCell>
                          <TableCell className="capitalize">{report.species}</TableCell>
                          <TableCell>{reasonLabels[report.reason]}</TableCell>
                          <TableCell>{new Date(report.cutting_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge className={statusColors[report.status]}>
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}